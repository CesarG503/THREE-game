import "iconify-icon";
import * as THREE from "three";
import { Router } from "../routing/Router";
import { clearStoredAuth, getAuthDisplayName, getStoredAuth, type StoredAuthSession } from "../platform/auth";
import { createEmptyMapData } from "../platform/mapDefaults";
import { createMap, deleteMap, listAssets, listMaps, uploadAsset, type PlatformAsset, type PlatformMap } from "../platform/api";
import { DEFAULT_POLYGON_SKIN_URL, getSelectedSkin, setSelectedSkin, type SelectedSkin } from "../platform/skinPreferences";
import { renderAuthScreen } from "./AuthScreen";
import { clampText, clear, createButton, createElement, createIcon, formatRelativeDate, prependIcon } from "./platform/dom";
import { injectPlatformStyles } from "./platform/styles";
import { initUiTelemetry } from "./analytics-ui";

const HIDDEN_IDS = [
	"loading",
	"crosshair",
	"inventory-container",
	"settings-panel",
	"overlay",
	"fuego-counter",
	"interaction-prompt",
	"button-interaction-prompt",
	"move-prompt-container"
];

type LobbyView = "home" | "discover" | "popular" | "create" | "library" | "profile" | "settings";

export function renderLobby(router: Router): () => void {
	injectPlatformStyles();

	const hiddenStates = new Map<string, string | null>();
	HIDDEN_IDS.forEach((id) => {
		const el = document.getElementById(id);
		if (!el) return;
		hiddenStates.set(id, el.style.display || "");
		el.style.display = "none";
	});

	const existing = document.getElementById("lobby-screen");
	if (existing) {
		return () => {
			existing.remove();
			cleanup(hiddenStates);
		};
	}

	let activeView: LobbyView = "home";
	let auth: StoredAuthSession | null = getStoredAuth();
	let publicMaps: PlatformMap[] = [];
	let myMaps: PlatformMap[] = [];
	let skinAssets: PlatformAsset[] = [];
	let selectedSkin: SelectedSkin = getSelectedSkin(auth);
	let query = "";
	let loading = true;
	let skinLoading = false;
	let status = "";
	let skinStatus = "";
	let authCleanup: (() => void) | null = null;
	let skinPreviewCleanup: (() => void) | null = null;
	let disposed = false;
	let unsubscribeRoute: () => void = () => {};

	const container = createElement("div", "vp-shell");
	container.id = "lobby-screen";
	document.body.appendChild(container);

	const uiTelemetry = initUiTelemetry(container, "lobby_catalog");

	const disposeLobby = () => {
		if (disposed) return;
		disposed = true;
		if (authCleanup) authCleanup();
		if (skinPreviewCleanup) skinPreviewCleanup();
		uiTelemetry.dispose();
		unsubscribeRoute();
		container.remove();
		cleanup(hiddenStates);
	};

	const setStatus = (message: string) => {
		status = message;
		render();
	};

	const setSkinStatus = (message: string) => {
		skinStatus = message;
		render();
	};

	const refreshMaps = async () => {
		loading = true;
		render();

		const [publicResult, mineResult] = await Promise.allSettled([
			listMaps("public"),
			auth ? listMaps("mine") : Promise.resolve([]),
		]);

		if (disposed) return;

		publicMaps = publicResult.status === "fulfilled" ? publicResult.value : [];
		myMaps = mineResult.status === "fulfilled" ? mineResult.value : [];
		loading = false;

		if (publicResult.status === "rejected") {
			status = publicResult.reason instanceof Error
				? publicResult.reason.message
				: "No se pudo leer la base de datos";
		}

		render();
		uiTelemetry.observeElements();
	};

	const refreshSkins = async () => {
		if (!auth) {
			skinAssets = [];
			selectedSkin = getSelectedSkin(auth);
			skinLoading = false;
			render();
			return;
		}

		skinLoading = true;
		render();

		try {
			skinAssets = await listAssets("mine", "CHARACTER_SKIN");
			selectedSkin = getSelectedSkin(auth);
			skinStatus = "";
		} catch (err) {
			skinStatus = err instanceof Error ? err.message : "No se pudo leer tus skins";
		} finally {
			skinLoading = false;
			if (!disposed) render();
		}
	};

	const openAuth = () => {
		if (authCleanup) authCleanup();
		authCleanup = renderAuthScreen((nextAuth) => {
			auth = nextAuth;
			selectedSkin = getSelectedSkin(auth);
			if (authCleanup) {
				authCleanup();
				authCleanup = null;
			}
			void refreshMaps();
			void refreshSkins();
		}, {
			subtitle: "Entra para crear, guardar y editar tus mapas.",
			cancelText: "Volver",
			onCancel: () => {
				if (authCleanup) {
					authCleanup();
					authCleanup = null;
				}
			},
		});
	};

	const openMatchmakingModal = (mapId?: string) => {
		const overlay = createElement("div", "vp-modal-overlay");
		const modal = createElement("div", "vp-modal");
		
		const header = createElement("div", "vp-modal-header");
		const title = createElement("h2", "vp-modal-title", "Búsqueda de Partida");
		const closeBtn = createButton("vp-modal-close-btn", "×", () => {
			cleanupMatchmaking();
			overlay.remove();
		});
		header.appendChild(title);
		header.appendChild(closeBtn);
		modal.appendChild(header);

		const content = createElement("div", "vp-modal-content");
		
		const label = createElement("label", "vp-label", "Seleccionar Región");
		const select = createElement("select", "vp-select") as HTMLSelectElement;
		
		const regions = [
			{ code: "us-east", name: "EE.UU. Este (Virginia)" },
			{ code: "eu-west", name: "Europa Oeste (Fráncfort)" },
			{ code: "sa-east", name: "Sudamérica Este (São Paulo)" },
			{ code: "asia-east", name: "Asia Este (Tokio)" },
		];
		
		const savedRegion = localStorage.getItem("vp-preferred-region") || "us-east";
		
		regions.forEach((r) => {
			const option = document.createElement("option");
			option.value = r.code;
			option.text = r.name;
			if (r.code === savedRegion) option.selected = true;
			select.appendChild(option);
		});
		
		label.appendChild(select);
		content.appendChild(label);
		
		const ewtDisplay = createElement("div", "vp-mm-ewt-display");
		const ewtLabel = createElement("span", "", "Tiempo estimado:");
		const ewtValue = createElement("span", "vp-mm-ewt-val", "Cargando...");
		ewtDisplay.appendChild(ewtLabel);
		ewtDisplay.appendChild(ewtValue);
		content.appendChild(ewtDisplay);

		const updateEWT = () => {
			const region = select.value;
			localStorage.setItem("vp-preferred-region", region);
			
			fetch(`/api/matchmaker/ewt?region=${region}`)
				.then((res) => res.json())
				.then((data) => {
					ewtValue.textContent = data.estimatedWaitRange || "30-45s";
				})
				.catch(() => {
					ewtValue.textContent = "30-45s";
				});
		};

		select.onchange = updateEWT;
		updateEWT();
		
		const actionBtn = createButton("vp-primary-btn", "Buscar Partida", () => {
			startSearch(select.value);
		});
		content.appendChild(actionBtn);
		
		modal.appendChild(content);
		overlay.appendChild(modal);
		document.body.appendChild(overlay);

		let searchInterval: any = null;
		let ticketId: string | null = null;
		let elapsedSeconds = 0;
		let timerInterval: any = null;

		const cleanupMatchmaking = () => {
			if (searchInterval) {
				clearInterval(searchInterval);
				searchInterval = null;
			}
			if (timerInterval) {
				clearInterval(timerInterval);
				timerInterval = null;
			}
			if (ticketId) {
				fetch("/api/matchmaker/leave", {
					method: "DELETE",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ ticketId }),
				}).catch(() => {});
				ticketId = null;
			}
		};

		const startSearch = (region: string) => {
			content.innerHTML = "";
			
			const searchState = createElement("div", "vp-mm-search-state");
			
			const pulseCircle = createElement("div", "vp-mm-pulse-circle");
			const pulseIcon = createIcon("mdi:radar", "vp-brand-icon");
			pulseIcon.style.color = "var(--vp-purple)";
			pulseCircle.appendChild(pulseIcon);
			searchState.appendChild(pulseCircle);
			
			const timerEl = createElement("div", "vp-mm-timer", "00:00");
			searchState.appendChild(timerEl);
			
			const currentEWT = ewtValue.textContent;
			const msgEl = createElement("div", "vp-mm-search-msg", `Buscando oponentes en ${regions.find(r => r.code === region)?.name}...\nTiempo estimado: ${currentEWT}`);
			searchState.appendChild(msgEl);
			
			const cancelBtn = createButton("vp-secondary-btn vp-mm-cancel-btn", "Cancelar Búsqueda", () => {
				cleanupMatchmaking();
				overlay.remove();
			});
			
			content.appendChild(searchState);
			content.appendChild(cancelBtn);
			
			const joinPayload: any = { region };
			if (mapId) joinPayload.mapId = mapId;
			if (auth?.user?.id) joinPayload.userId = auth.user.id;
			
			fetch("/api/matchmaker/join", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(joinPayload),
			})
				.then((res) => res.json())
				.then((data) => {
					ticketId = data.ticketId;
					
					timerInterval = setInterval(() => {
						elapsedSeconds++;
						const m = Math.floor(elapsedSeconds / 60).toString().padStart(2, "0");
						const s = (elapsedSeconds % 60).toString().padStart(2, "0");
						timerEl.textContent = `${m}:${s}`;
					}, 1000);
					
					searchInterval = setInterval(() => {
						if (!ticketId) return;
						fetch(`/api/matchmaker/ticket?ticketId=${ticketId}`)
							.then((res) => res.json())
							.then((ticketData) => {
								if (ticketData.status === "matched") {
									const match = ticketData.match;
									cleanupMatchmaking();
									overlay.remove();
									router.navigate("play", match.roomId);
								} else if (ticketData.status === "waiting") {
									msgEl.textContent = `Buscando oponentes (Posición: ${ticketData.queuePosition})...\nTiempo estimado: ${currentEWT}`;
								} else if (ticketData.status === "not_found") {
									cleanupMatchmaking();
									overlay.remove();
									alert("La búsqueda de partida expiró o fue cancelada.");
								}
							})
							.catch((err) => {
								console.error("Error polling matchmaking ticket status", err);
							});
					}, 2000);
				})
				.catch((err) => {
					console.error("Failed to join matchmaking queue", err);
					cleanupMatchmaking();
					overlay.remove();
					alert("Error al iniciar el emparejamiento. Intente de nuevo.");
				});
		};
	};

	const navigateToMap = (mode: "play" | "editor", map: PlatformMap) => {
		if (mode === "play") {
			openMatchmakingModal(map.id);
		} else {
			router.navigate(mode, map.slug);
		}
	};

	const switchView = (view: LobbyView) => {
		activeView = view;
		render();
		if (view === "profile") void refreshSkins();
	};

	const activateSkin = (skin: SelectedSkin) => {
		selectedSkin = skin;
		setSelectedSkin(auth, skin);
		setSkinStatus("Skin activa actualizada");
	};

	const uploadProfileSkin = async (file: File) => {
		if (!auth) {
			openAuth();
			return;
		}

		skinLoading = true;
		skinStatus = "Subiendo skin...";
		render();

		try {
			const asset = await uploadAsset(file, {
				kind: "CHARACTER_SKIN",
				visibility: "UNLISTED",
				name: file.name,
				metadata: { source: "lobby-profile" },
			});
			const nextSkin = { assetId: asset.id, url: asset.fileUrl, name: asset.name };
			setSelectedSkin(auth, nextSkin);
			selectedSkin = nextSkin;
			skinStatus = "Skin subida y activada";
			await refreshSkins();
		} catch (err) {
			skinStatus = err instanceof Error ? err.message : "No se pudo subir la skin";
			skinLoading = false;
			render();
		}
	};

	const render = () => {
		if (disposed) return;
		if (router.getMode() !== "lobby") {
			disposeLobby();
			return;
		}
		if (skinPreviewCleanup) {
			skinPreviewCleanup();
			skinPreviewCleanup = null;
		}
		clear(container);
		container.appendChild(renderSidebar(activeView, switchView, auth));
		container.appendChild(renderMain());
	};

	const renderMain = () => {
		const main = createElement("main", "vp-main");
		main.appendChild(renderTopbar());

		const content = createElement("div", "vp-content");
		const feed = createElement("section", "vp-feed");
		const rail = createElement("aside", "vp-rail");

		if (activeView === "create") {
			feed.appendChild(renderCreateView(router, auth, openAuth, setStatus));
		} else if (activeView === "library") {
			feed.appendChild(renderLibraryView(myMaps, auth, navigateToMap, handleDeleteMap));
		} else if (activeView === "profile") {
			feed.appendChild(renderProfileView({
				auth,
				myMaps,
				openAuth,
				skinAssets,
				selectedSkin,
				skinLoading,
				skinStatus,
				onActivateSkin: activateSkin,
				onUploadSkin: uploadProfileSkin,
				registerPreviewCleanup: (cleanup) => {
					skinPreviewCleanup = cleanup;
				},
			}));
		} else if (activeView === "settings") {
			feed.appendChild(renderSettingsView());
		} else {
			feed.appendChild(renderHomeHero());
			feed.appendChild(renderContinueSection());
			feed.appendChild(renderMapSection(activeView));
		}

		rail.appendChild(renderActivityPanel([...myMaps, ...publicMaps]));
		rail.appendChild(renderRankingPanel([...myMaps, ...publicMaps]));
		rail.appendChild(renderStatusPanel());

		content.appendChild(feed);
		content.appendChild(rail);
		main.appendChild(content);
		return main;
	};

	const renderTopbar = () => {
		const topbar = createElement("header", "vp-topbar");

		const search = createElement("input", "vp-search") as HTMLInputElement;
		search.type = "search";
		search.placeholder = "Buscar experiencias, amigos, clanes o mapas...";
		search.value = query;
		search.oninput = () => {
			query = search.value;
			render();
			const nextSearch = document.querySelector<HTMLInputElement>(".vp-search");
			if (nextSearch) {
				nextSearch.focus();
				nextSearch.setSelectionRange(query.length, query.length);
			}
		};

		const actions = createElement("div", "vp-top-actions");
		const playNowButton = createButton("vp-primary-btn vp-icon-btn", "Jugar ahora", () => {
			const featured = getFeaturedMap();
			if (featured) {
				navigateToMap("play", featured);
			} else {
				openMatchmakingModal();
			}
		});
		prependIcon(playNowButton, "mdi:play");
		actions.appendChild(playNowButton);

		const online = createElement("div", "vp-status-pill");
		online.appendChild(createIcon("mdi:account-group"));
		online.appendChild(document.createTextNode(`${Math.max(1, publicMaps.length + myMaps.length)} online`));
		const avatar = createElement("button", "vp-avatar", getInitials(getAuthDisplayName(auth)));
		avatar.type = "button";
		avatar.onclick = auth ? () => switchView("profile") : openAuth;

		actions.appendChild(online);
		actions.appendChild(avatar);

		topbar.appendChild(search);
		topbar.appendChild(actions);
		return topbar;
	};

	const renderHomeHero = () => {
		const featured = getFeaturedMap();
		const hero = createElement("section", "vp-hero");
		const body = createElement("div", "vp-hero-body");
		const badges = createElement("div", "vp-badge-row");
		badges.appendChild(createBadge(featured ? "mdi:star" : "mdi:magic-staff", featured ? "#1 Mapa destacado" : "#1 Crea tu arena"));
		badges.appendChild(createBadge(featured?.isPublished ? "mdi:broadcast" : "mdi:hammer-wrench", featured?.isPublished ? "En vivo" : "Editor Studio", "dark"));

		const title = createElement("h1", "vp-hero-title", featured?.name || "VIPER ARENA");
		const copy = createElement(
			"p",
			"vp-hero-copy",
			featured
				? clampText(featured.description, "Mapa guardado en la base de datos listo para jugar o editar.")
				: "Construye arenas, guarda versiones y vuelve a editarlas desde tu biblioteca."
		);

		const meta = createElement("div", "vp-hero-meta");
		meta.appendChild(createMeta("mdi:cube", `${featured?.objectCount ?? 0} objetos`));
		meta.appendChild(createMeta("mdi:layers", `${featured?.version ?? 0} versiones`));
		meta.appendChild(createMeta("mdi:clock-outline", featured ? formatRelativeDate(featured.updatedAt) : "Listo para crear"));

		const actions = createElement("div", "vp-actions");
		if (featured) {
			actions.appendChild(prependIcon(createButton("vp-primary-btn vp-icon-btn", "Entrar ahora", () => navigateToMap("play", featured)), "mdi:lightning-bolt"));
			if (auth?.user.id === featured.ownerId) {
				actions.appendChild(prependIcon(createButton("vp-secondary-btn vp-icon-btn", "Editar mapa", () => navigateToMap("editor", featured)), "mdi:pencil-box"));
			}
		} else {
			actions.appendChild(prependIcon(createButton("vp-primary-btn vp-icon-btn", "Crear mapa", () => switchView("create")), "mdi:hammer-wrench"));
			actions.appendChild(prependIcon(createButton("vp-secondary-btn vp-icon-btn", "Jugar sala libre", () => openMatchmakingModal()), "mdi:gamepad-variant"));
		}

		body.appendChild(badges);
		body.appendChild(title);
		body.appendChild(copy);
		body.appendChild(meta);
		body.appendChild(actions);
		hero.appendChild(body);
		return hero;
	};

	const renderContinueSection = () => {
		const section = createElement("section");
		section.appendChild(createElement("h2", "vp-section-title", "Continuar editando"));

		const grid = createElement("div", "vp-card-grid");
		const maps = filterMaps(myMaps).slice(0, 2);
		if (!auth) {
			grid.appendChild(renderEmptyCard("Entra para ver tus mapas guardados.", openAuth));
		} else if (!maps.length) {
			grid.appendChild(renderEmptyCard("Aun no tienes mapas guardados.", () => switchView("create")));
		} else {
			maps.forEach((map, index) => grid.appendChild(renderSessionCard(map, index)));
		}
		section.appendChild(grid);
		return section;
	};

	const renderMapSection = (view: LobbyView) => {
		const section = createElement("section");
		const title = view === "popular" ? "Popular ahora" : view === "discover" ? "Descubrir mapas" : "Mapas destacados";
		section.appendChild(createElement("h2", "vp-section-title", title));

		const grid = createElement("div", "vp-card-grid");
		const maps = filterMaps(view === "popular" ? sortByObjects(publicMaps) : publicMaps).slice(0, 8);
		if (loading) {
			grid.appendChild(createElement("div", "vp-empty", "Cargando mapas desde la base de datos..."));
		} else if (!maps.length) {
			grid.appendChild(renderEmptyCard("No hay mapas publicados todavia.", () => switchView("create")));
		} else {
			maps.forEach((map, index) => grid.appendChild(renderMapCard(map, index)));
		}

		section.appendChild(grid);
		return section;
	};

	const renderSessionCard = (map: PlatformMap, index: number) => {
		const card = createElement("article", "vp-session-card");
		card.setAttribute("data-track-id", map.slug);
		card.setAttribute("data-track-type", "map_session_card");
		card.style.padding = "16px";
		card.style.display = "grid";
		card.style.gridTemplateColumns = "86px minmax(0, 1fr) auto";
		card.style.gap = "16px";
		card.style.alignItems = "center";

		const preview = createElement("div", `vp-map-preview alt-${index % 3}`);
		preview.style.height = "70px";
		preview.style.borderRadius = "8px";

		const body = createElement("div");
		body.appendChild(createElement("h3", "vp-map-title", map.name));
		body.appendChild(createElement("div", "vp-muted", `${formatRelativeDate(map.updatedAt)} · v${map.version}`));

		const edit = prependIcon(createButton("vp-primary-btn vp-icon-btn", "Seguir", () => navigateToMap("editor", map)), "mdi:play");
		edit.setAttribute("data-click-action", "edit_map");
		card.appendChild(preview);
		card.appendChild(body);
		card.appendChild(edit);
		return card;
	};

	const renderMapCard = (map: PlatformMap, index: number) => {
		const card = createElement("article", "vp-map-card");
		card.setAttribute("data-track-id", map.slug);
		card.setAttribute("data-track-type", "map_card");
		const preview = createElement("div", `vp-map-preview alt-${index % 3}`);
		preview.appendChild(createElement("span", "vp-map-pill", `${map.objectCount} objetos`));

		const body = createElement("div", "vp-map-body");
		body.appendChild(createElement("h3", "vp-map-title", map.name));
		body.appendChild(createElement("div", "vp-map-copy", clampText(map.description, "Arena creada por la comunidad.")));

		const stats = createElement("div", "vp-map-stats");
		stats.appendChild(createMeta("mdi:layers", `v${map.version}`));
		stats.appendChild(createMeta("mdi:archive-check", `${map.versionCount} guardados`));
		stats.appendChild(createMeta("mdi:clock-outline", formatRelativeDate(map.updatedAt)));

		const actions = createElement("div", "vp-card-actions");
		const playBtn = prependIcon(createButton("vp-primary-btn vp-icon-btn", "Jugar", () => navigateToMap("play", map)), "mdi:play");
		playBtn.setAttribute("data-click-action", "play_map");
		actions.appendChild(playBtn);
		
		if (auth?.user.id === map.ownerId) {
			const editBtn = prependIcon(createButton("vp-secondary-btn vp-icon-btn", "Editar", () => navigateToMap("editor", map)), "mdi:pencil-box");
			editBtn.setAttribute("data-click-action", "edit_map");
			actions.appendChild(editBtn);
		} else {
			const viewBtn = prependIcon(createButton("vp-secondary-btn vp-icon-btn", "Ver sala", () => navigateToMap("play", map)), "mdi:eye");
			viewBtn.setAttribute("data-click-action", "view_room");
			actions.appendChild(viewBtn);
		}

		body.appendChild(stats);
		body.appendChild(actions);
		card.appendChild(preview);
		card.appendChild(body);
		return card;
	};

	const renderStatusPanel = () => {
		const panel = createElement("section", "vp-panel");
		panel.appendChild(createElement("h3", "vp-panel-title", "Estado"));
		panel.appendChild(createElement("div", "vp-muted", auth ? `Cuenta: ${getAuthDisplayName(auth)}` : "Invitado"));
		panel.appendChild(createElement("div", "vp-muted", `${myMaps.length} mapas propios · ${publicMaps.length} publicados`));
		const toast = createElement("div", "vp-toast", status);
		panel.appendChild(toast);
		return panel;
	};

	const getFeaturedMap = () => filterMaps(publicMaps)[0] || filterMaps(myMaps)[0] || null;

	const filterMaps = (maps: PlatformMap[]) => {
		const normalizedQuery = query.trim().toLowerCase();
		if (!normalizedQuery) return maps;
		return maps.filter((map) => {
			const haystack = `${map.name} ${map.description || ""} ${map.owner?.username || ""}`.toLowerCase();
			return haystack.includes(normalizedQuery);
		});
	};

	const handleDeleteMap = async (map: PlatformMap) => {
		if (!window.confirm(`Eliminar "${map.name}"?`)) return;
		try {
			await deleteMap(map.slug);
			setStatus("Mapa eliminado");
			await refreshMaps();
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "No se pudo eliminar el mapa");
		}
	};

	render();
	void refreshMaps();
	void refreshSkins();

	unsubscribeRoute = router.onChange((route) => {
		if (route.mode !== "lobby") disposeLobby();
	});

	return disposeLobby;
}

function renderSidebar(
	activeView: LobbyView,
	switchView: (view: LobbyView) => void,
	auth: StoredAuthSession | null,
) {
	const sidebar = createElement("aside", "vp-sidebar");
	const brand = createElement("div", "vp-brand");
	const brandMark = createElement("span", "vp-brand-mark");
	brandMark.appendChild(createIcon("mdi:gamepad-variant", "vp-brand-icon"));
	brand.appendChild(brandMark);
	brand.appendChild(createElement("span", "vp-brand-text", "VIPERIO"));
	sidebar.appendChild(brand);

	const nav = createElement("nav", "vp-nav");
	[
		["home", "mdi:home-variant", "Inicio"],
		["discover", "mdi:compass", "Descubrir"],
		["popular", "mdi:fire", "Popular"],
	].forEach(([view, icon, label]) => {
		nav.appendChild(navButton(view as LobbyView, icon, label, activeView, switchView));
	});

	const secondary = createElement("nav", "vp-nav vp-nav-secondary");
	secondary.appendChild(navButton("profile", "mdi:account-circle", "Mi perfil", activeView, switchView));
	secondary.appendChild(navButton("create", "mdi:hammer-wrench", "Crear mapa", activeView, switchView, "is-create"));
	secondary.appendChild(navButton("library", "mdi:folder-multiple", "Biblioteca", activeView, switchView));
	secondary.appendChild(navButton("settings", "mdi:cog", "Configuracion", activeView, switchView));

	if (auth) {
		const logout = createButton("vp-nav-btn", "", () => {
			clearStoredAuth();
			window.location.reload();
		});
		logout.appendChild(createIcon("mdi:logout", "vp-nav-icon"));
		logout.appendChild(createElement("span", "vp-nav-label", "Salir"));
		secondary.appendChild(logout);
	}

	sidebar.appendChild(nav);
	sidebar.appendChild(secondary);
	return sidebar;
}

function navButton(
	view: LobbyView,
	icon: string,
	label: string,
	activeView: LobbyView,
	switchView: (view: LobbyView) => void,
	extraClass = "",
) {
	const button = createButton(`vp-nav-btn ${activeView === view ? "is-active" : ""} ${extraClass}`, "", () => switchView(view));
	button.appendChild(createIcon(icon, "vp-nav-icon"));
	button.appendChild(createElement("span", "vp-nav-label", label));
	return button;
}

function renderCreateView(
	router: Router,
	auth: StoredAuthSession | null,
	openAuth: () => void,
	setStatus: (message: string) => void,
) {
	const section = createElement("section");
	section.appendChild(createElement("h1", "vp-section-title", "Crear mapa"));

	if (!auth) {
		const empty = createElement("div", "vp-empty");
		empty.appendChild(createElement("h2", "vp-map-title", "Necesitas una cuenta"));
		empty.appendChild(createElement("p", "vp-muted", "Los mapas se guardan en la base de datos de tu perfil."));
		empty.appendChild(prependIcon(createButton("vp-primary-btn vp-icon-btn", "Entrar", openAuth), "mdi:login"));
		section.appendChild(empty);
		return section;
	}

	const form = createElement("form", "vp-form") as HTMLFormElement;
	const fields = createElement("div", "vp-panel vp-fieldset");
	const side = createElement("aside", "vp-panel");

	const name = labeledInput("Nombre", "text", "Arena Neon Drift");
	const description = labeledTextarea("Descripcion", "Modo, reglas o notas del mapa.");
	const publish = createElement("label", "vp-toggle-row");
	const publishCopy = createElement("span");
	publishCopy.appendChild(createElement("strong", "", "Publicar en descubrir"));
	publishCopy.appendChild(createElement("div", "vp-muted", "Otros jugadores podran entrar desde el inicio."));
	const publishInput = document.createElement("input");
	publishInput.type = "checkbox";
	publishInput.checked = true;
	publish.appendChild(publishCopy);
	publish.appendChild(publishInput);

	fields.appendChild(name.label);
	fields.appendChild(description.label);
	fields.appendChild(publish);

	side.appendChild(createElement("h3", "vp-panel-title", "Plantilla"));
	side.appendChild(createElement("div", "vp-muted", "Mapa vacio · suelo 100x100 · Skybox 04 · listo para editor."));
	side.appendChild(createElement("div", "vp-toast"));
	side.appendChild(prependIcon(createButton("vp-primary-btn vp-icon-btn", "Crear y editar", () => form.requestSubmit()), "mdi:hammer-wrench"));

	form.onsubmit = async (event) => {
		event.preventDefault();
		const submit = form.querySelector("button") as HTMLButtonElement | null;
		if (submit) submit.disabled = true;
		try {
			const map = await createMap({
				name: name.input.value,
				description: description.input.value,
				isPublished: publishInput.checked,
				data: createEmptyMapData(),
			});
			router.navigate("editor", map.slug);
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "No se pudo crear el mapa");
		} finally {
			if (submit) submit.disabled = false;
		}
	};

	form.appendChild(fields);
	form.appendChild(side);
	section.appendChild(form);
	return section;
}

function renderLibraryView(
	myMaps: PlatformMap[],
	auth: StoredAuthSession | null,
	navigateToMap: (mode: "play" | "editor", map: PlatformMap) => void,
	onDelete: (map: PlatformMap) => void,
) {
	const section = createElement("section");
	section.appendChild(createElement("h1", "vp-section-title", "Biblioteca"));

	if (!auth) {
		section.appendChild(createElement("div", "vp-empty", "Entra para ver tus mapas guardados."));
		return section;
	}

	const grid = createElement("div", "vp-card-grid");
	if (!myMaps.length) {
		grid.appendChild(createElement("div", "vp-empty", "Todavia no hay mapas en tu biblioteca."));
	} else {
		myMaps.forEach((map, index) => {
			const card = createElement("article", "vp-map-card");
			const preview = createElement("div", `vp-map-preview alt-${index % 3}`);
			preview.appendChild(createElement("span", "vp-map-pill", map.isPublished ? "Publicado" : "Privado"));
			const body = createElement("div", "vp-map-body");
			body.appendChild(createElement("h3", "vp-map-title", map.name));
			body.appendChild(createElement("div", "vp-map-copy", clampText(map.description, "Sin descripcion.")));
			body.appendChild(createElement("div", "vp-map-stats", `${map.objectCount} objetos · v${map.version} · ${formatRelativeDate(map.updatedAt)}`));
			const actions = createElement("div", "vp-card-actions");
			actions.appendChild(prependIcon(createButton("vp-primary-btn vp-icon-btn", "Editar", () => navigateToMap("editor", map)), "mdi:pencil-box"));
			actions.appendChild(prependIcon(createButton("vp-secondary-btn vp-icon-btn", "Jugar", () => navigateToMap("play", map)), "mdi:play"));
			actions.appendChild(prependIcon(createButton("vp-danger-btn vp-icon-btn", "Eliminar", () => onDelete(map)), "mdi:trash-can"));
			body.appendChild(actions);
			card.appendChild(preview);
			card.appendChild(body);
			grid.appendChild(card);
		});
	}

	section.appendChild(grid);
	return section;
}

interface ProfileViewOptions {
	auth: StoredAuthSession | null;
	myMaps: PlatformMap[];
	openAuth: () => void;
	skinAssets: PlatformAsset[];
	selectedSkin: SelectedSkin;
	skinLoading: boolean;
	skinStatus: string;
	onActivateSkin: (skin: SelectedSkin) => void;
	onUploadSkin: (file: File) => void;
	registerPreviewCleanup: (cleanup: () => void) => void;
}

function renderProfileView(options: ProfileViewOptions) {
	const {
		auth,
		myMaps,
		openAuth,
		skinAssets,
		selectedSkin,
		skinLoading,
		skinStatus,
		onActivateSkin,
		onUploadSkin,
		registerPreviewCleanup,
	} = options;
	const section = createElement("section");
	section.appendChild(createElement("h1", "vp-section-title", "Mi perfil"));

	if (!auth) {
		const panel = createElement("div", "vp-panel");
		panel.appendChild(createElement("div", "vp-muted", "Sesion de invitado"));
		panel.appendChild(prependIcon(createButton("vp-primary-btn vp-icon-btn", "Entrar", openAuth), "mdi:login"));
		section.appendChild(panel);
		return section;
	} else {
		const profileHeader = createElement("div", "vp-profile-header");
		const identity = createElement("div");
		identity.appendChild(createElement("h2", "vp-map-title", getAuthDisplayName(auth)));
		identity.appendChild(createElement("div", "vp-muted", auth.user.email));
		identity.appendChild(createElement("div", "vp-muted", `${myMaps.length} mapas guardados · ${skinAssets.length} skins`));
		profileHeader.appendChild(identity);
		profileHeader.appendChild(prependIcon(createButton("vp-danger-btn vp-icon-btn", "Cerrar sesion", () => {
			clearStoredAuth();
			window.location.reload();
		}), "mdi:logout"));
		section.appendChild(profileHeader);
	}

	const skinTitle = createElement("h2", "vp-section-title", "Tus Skins");
	section.appendChild(skinTitle);

	const skinLayout = createElement("div", "vp-skin-layout");
	const previewPanel = createElement("article", "vp-panel vp-skin-preview-panel");
	previewPanel.appendChild(createElement("h3", "vp-panel-title", "Previsualizacion de skin"));
	const previewStage = createElement("div", "vp-skin-stage");
	previewPanel.appendChild(previewStage);
	const controls = createElement("div", "vp-skin-controls");
	const rotateLeft = prependIcon(createButton("vp-secondary-btn vp-icon-btn", "Girar", () => previewStage.dispatchEvent(new CustomEvent("skin-rotate", { detail: -0.35 }))), "mdi:rotate-left");
	const rotateRight = prependIcon(createButton("vp-secondary-btn vp-icon-btn", "Girar", () => previewStage.dispatchEvent(new CustomEvent("skin-rotate", { detail: 0.35 }))), "mdi:rotate-right");
	const zoomIn = prependIcon(createButton("vp-secondary-btn vp-icon-btn", "Zoom", () => previewStage.dispatchEvent(new CustomEvent("skin-zoom", { detail: -0.25 }))), "mdi:magnify-plus");
	const zoomOut = prependIcon(createButton("vp-secondary-btn vp-icon-btn", "Zoom", () => previewStage.dispatchEvent(new CustomEvent("skin-zoom", { detail: 0.25 }))), "mdi:magnify-minus");
	controls.appendChild(rotateLeft);
	controls.appendChild(rotateRight);
	controls.appendChild(zoomIn);
	controls.appendChild(zoomOut);
	previewPanel.appendChild(controls);
	previewPanel.appendChild(createElement("div", "vp-muted", selectedSkin.name || "Skin activa"));

	const preview = new SkinPreviewController(previewStage, selectedSkin.url);
	registerPreviewCleanup(() => preview.dispose());

	const libraryPanel = createElement("article", "vp-panel vp-skin-library-panel");
	libraryPanel.appendChild(createElement("h3", "vp-panel-title", "Biblioteca de skins"));
	const skinGrid = createElement("div", "vp-skin-grid");
	skinGrid.appendChild(renderSkinTile({
		id: null,
		name: "Skin base",
		url: DEFAULT_POLYGON_SKIN_URL,
		active: selectedSkin.assetId === null,
		onActivate: () => onActivateSkin({ assetId: null, url: DEFAULT_POLYGON_SKIN_URL, name: "Skin base" }),
	}));

	skinAssets.forEach((asset) => {
		skinGrid.appendChild(renderSkinTile({
			id: asset.id,
			name: asset.name,
			url: asset.fileUrl,
			active: selectedSkin.assetId === asset.id,
			onActivate: () => onActivateSkin({ assetId: asset.id, url: asset.fileUrl, name: asset.name }),
		}));
	});

	if (skinLoading) {
		skinGrid.appendChild(createElement("div", "vp-skin-empty", "Cargando..."));
	} else if (!skinAssets.length) {
		skinGrid.appendChild(createElement("div", "vp-skin-empty", "Sube una skin PNG 64x64."));
	}

	const fileInput = document.createElement("input");
	fileInput.type = "file";
	fileInput.accept = "image/png";
	fileInput.style.display = "none";
	fileInput.onchange = () => {
		const file = fileInput.files?.[0];
		if (!file) return;
		onUploadSkin(file);
		fileInput.value = "";
	};

	const uploadButton = prependIcon(createButton("vp-primary-btn vp-icon-btn vp-skin-upload-btn", skinLoading ? "Subiendo..." : "Subir tu skin", () => fileInput.click()), "mdi:cloud-upload");
	(uploadButton as HTMLButtonElement).disabled = skinLoading;

	libraryPanel.appendChild(skinGrid);
	libraryPanel.appendChild(fileInput);
	libraryPanel.appendChild(uploadButton);
	if (skinStatus) libraryPanel.appendChild(createElement("div", "vp-toast", skinStatus));

	skinLayout.appendChild(previewPanel);
	skinLayout.appendChild(libraryPanel);
	section.appendChild(skinLayout);
	return section;
}

function renderSkinTile(input: { id: string | null; name: string; url: string; active: boolean; onActivate: () => void }) {
	const tile = createElement("button", `vp-skin-tile ${input.active ? "is-active" : ""}`) as HTMLButtonElement;
	tile.type = "button";
	tile.title = input.name;
	tile.onclick = input.onActivate;
	const preview = createElement("span", "vp-skin-tile-preview");
	preview.style.backgroundImage = `url("${input.url}")`;
	tile.appendChild(preview);
	if (input.active) tile.appendChild(createElement("span", "vp-skin-active", "Activa"));
	return tile;
}

class SkinPreviewController {
	private renderer: THREE.WebGLRenderer;
	private scene: THREE.Scene;
	private camera: THREE.PerspectiveCamera;
	private model: THREE.Group;
	private animationFrame = 0;
	private yaw = 0.45;
	private zoom = 4.1;
	private disposed = false;
	private resizeObserver: ResizeObserver;
	private rotateHandler: EventListener;
	private zoomHandler: EventListener;

	constructor(private mount: HTMLElement, skinUrl: string) {
		this.scene = new THREE.Scene();
		this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
		this.camera.position.set(0, 1.25, this.zoom);

		this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
		this.renderer.outputColorSpace = THREE.SRGBColorSpace;
		this.renderer.domElement.className = "vp-skin-canvas";
		this.mount.appendChild(this.renderer.domElement);

		const ambient = new THREE.HemisphereLight(0xffffff, 0x1b2440, 2.1);
		const key = new THREE.DirectionalLight(0xffffff, 2.4);
		key.position.set(2.2, 3.4, 4);
		this.scene.add(ambient, key);

		this.model = this.createModel(skinUrl);
		this.model.rotation.y = this.yaw;
		this.scene.add(this.model);

		this.rotateHandler = (event) => {
			this.yaw += Number((event as CustomEvent<number>).detail || 0);
			this.model.rotation.y = this.yaw;
			this.renderFrame();
		};
		this.zoomHandler = (event) => {
			this.zoom = THREE.MathUtils.clamp(this.zoom + Number((event as CustomEvent<number>).detail || 0), 2.7, 5.5);
			this.camera.position.z = this.zoom;
			this.renderFrame();
		};
		this.mount.addEventListener("skin-rotate", this.rotateHandler);
		this.mount.addEventListener("skin-zoom", this.zoomHandler);

		this.resizeObserver = new ResizeObserver(() => this.resize());
		this.resizeObserver.observe(this.mount);
		this.resize();
		this.animate();
	}

	dispose() {
		if (this.disposed) return;
		this.disposed = true;
		cancelAnimationFrame(this.animationFrame);
		this.resizeObserver.disconnect();
		this.mount.removeEventListener("skin-rotate", this.rotateHandler);
		this.mount.removeEventListener("skin-zoom", this.zoomHandler);
		this.model.traverse((child: any) => {
			if (child.geometry) child.geometry.dispose();
			if (child.material) {
				const materials = Array.isArray(child.material) ? child.material : [child.material];
				materials.forEach((material: THREE.Material & { map?: THREE.Texture }) => {
					material.map?.dispose();
					material.dispose();
				});
			}
		});
		this.renderer.dispose();
		this.renderer.domElement.remove();
	}

	private resize() {
		const rect = this.mount.getBoundingClientRect();
		const width = Math.max(180, Math.floor(rect.width));
		const height = Math.max(260, Math.floor(rect.height));
		this.camera.aspect = width / height;
		this.camera.updateProjectionMatrix();
		this.renderer.setSize(width, height, false);
		this.renderFrame();
	}

	private animate = () => {
		if (this.disposed) return;
		this.model.rotation.y += 0.003;
		this.yaw = this.model.rotation.y;
		this.renderFrame();
		this.animationFrame = requestAnimationFrame(this.animate);
	};

	private renderFrame() {
		this.camera.lookAt(0, 0.95, 0);
		this.renderer.render(this.scene, this.camera);
	}

	private createModel(skinUrl: string) {
		const group = new THREE.Group();
		group.position.y = -0.1;

		const texture = new THREE.TextureLoader().load(skinUrl);
		texture.magFilter = THREE.NearestFilter;
		texture.minFilter = THREE.NearestFilter;
		texture.colorSpace = THREE.SRGBColorSpace;

		const material = new THREE.MeshStandardMaterial({
			map: texture,
			roughness: 0.92,
			metalness: 0,
			transparent: true,
			alphaTest: 0.5,
			side: THREE.DoubleSide,
		});

		const pixel = 0.055;
		const addPart = (name: string, w: number, h: number, d: number, u: number, v: number, x: number, y: number, z: number) => {
			const mesh = new THREE.Mesh(createSkinBoxGeometry(w, h, d, u, v), material);
			mesh.name = name;
			mesh.scale.set(pixel, pixel, pixel);
			mesh.position.set(x, y, z);
			group.add(mesh);
			return mesh;
		};

		addPart("head", 8, 8, 8, 0, 0, 0, 1.88, 0);
		addPart("body", 8, 12, 4, 16, 16, 0, 1.32, 0);
		addPart("rightArm", 4, 12, 4, 40, 16, 0.34, 1.32, 0);
		addPart("leftArm", 4, 12, 4, 32, 48, -0.34, 1.32, 0);
		addPart("rightLeg", 4, 12, 4, 0, 16, 0.12, 0.66, 0);
		addPart("leftLeg", 4, 12, 4, 16, 48, -0.12, 0.66, 0);
		return group;
	}
}

function createSkinBoxGeometry(w: number, h: number, d: number, u: number, v: number) {
	const geometry = new THREE.BoxGeometry(w, h, d);
	const width = 64;
	const height = 64;

	const mapUV = (x: number, y: number, w1: number, h1: number) => {
		const u1 = x / width;
		const v1 = 1 - (y + h1) / height;
		const u2 = (x + w1) / width;
		const v2 = 1 - y / height;
		return [
			new THREE.Vector2(u2, v1),
			new THREE.Vector2(u2, v2),
			new THREE.Vector2(u1, v2),
			new THREE.Vector2(u1, v1),
		];
	};

	const order = [
		mapUV(u, v + d, d, h),
		mapUV(u + d + w, v + d, d, h),
		mapUV(u + d, v, w, d),
		mapUV(u + d + w, v, w, d),
		mapUV(u + d, v + d, w, h),
		mapUV(u + d + w + d, v + d, w, h),
	];
	const uvAttribute = geometry.attributes.uv;

	for (let i = 0; i < 6; i += 1) {
		const faceUVs = order[i];
		uvAttribute.setXY(i * 4 + 0, faceUVs[2].x, faceUVs[2].y);
		uvAttribute.setXY(i * 4 + 1, faceUVs[1].x, faceUVs[1].y);
		uvAttribute.setXY(i * 4 + 2, faceUVs[3].x, faceUVs[3].y);
		uvAttribute.setXY(i * 4 + 3, faceUVs[0].x, faceUVs[0].y);
	}

	geometry.attributes.uv.needsUpdate = true;
	return geometry;
}

function renderSettingsView() {
	const section = createElement("section");
	section.appendChild(createElement("h1", "vp-section-title", "Configuracion"));
	const panel = createElement("div", "vp-panel");
	panel.appendChild(createElement("h2", "vp-map-title", "Tema"));
	panel.appendChild(createElement("div", "vp-muted", "La paleta vive en src/client/ui/platform/styles.ts como variables CSS."));
	section.appendChild(panel);
	return section;
}

function renderActivityPanel(maps: PlatformMap[]) {
	const panel = createElement("section", "vp-panel");
	panel.appendChild(createElement("h3", "vp-panel-title", "Actividad en vivo"));
	const list = createElement("div", "vp-activity-list");
	sortByDate(maps).slice(0, 4).forEach((map) => {
		const item = createElement("div", "vp-activity-item");
		const avatar = createElement("div", "vp-dot-avatar", getInitials(map.owner?.displayName || map.owner?.username || "V"));
		item.appendChild(avatar);
		const copy = createElement("div");
		copy.appendChild(createElement("strong", "", map.name));
		copy.appendChild(createElement("div", "vp-muted", `${map.objectCount} objetos · ${formatRelativeDate(map.updatedAt)}`));
		item.appendChild(copy);
		list.appendChild(item);
	});
	if (!list.children.length) list.appendChild(createElement("div", "vp-muted", "Sin actividad todavia."));
	panel.appendChild(list);
	return panel;
}

function renderRankingPanel(maps: PlatformMap[]) {
	const panel = createElement("section", "vp-panel");
	panel.appendChild(createElement("h3", "vp-panel-title", "Rankings"));
	const list = createElement("div", "vp-rank-list");
	sortByObjects(maps).slice(0, 5).forEach((map, index) => {
		const item = createElement("div", "vp-rank-item");
		const rank = createElement("div", "vp-dot-avatar");
		rank.appendChild(createIcon(index === 0 ? "mdi:trophy" : "mdi:chart-line"));
		item.appendChild(rank);
		const copy = createElement("div");
		copy.appendChild(createElement("strong", "", map.name));
		copy.appendChild(createElement("div", "vp-muted", `${map.objectCount} objetos · v${map.version}`));
		item.appendChild(copy);
		list.appendChild(item);
	});
	if (!list.children.length) list.appendChild(createElement("div", "vp-muted", "Publica un mapa para aparecer aqui."));
	panel.appendChild(list);
	return panel;
}

function renderEmptyCard(text: string, action: () => void) {
	const empty = createElement("div", "vp-empty");
	empty.appendChild(createElement("div", "", text));
	empty.appendChild(prependIcon(createButton("vp-secondary-btn vp-icon-btn", "Continuar", action), "mdi:arrow-right"));
	return empty;
}

function createBadge(icon: string, text: string, variant = "") {
	const badge = createElement("span", `vp-badge ${variant}`.trim());
	badge.appendChild(createIcon(icon));
	badge.appendChild(document.createTextNode(text));
	return badge;
}

function createMeta(icon: string, text: string) {
	const meta = createElement("span", "vp-meta-item");
	meta.appendChild(createIcon(icon));
	meta.appendChild(document.createTextNode(text));
	return meta;
}

function labeledInput(title: string, type: string, placeholder: string) {
	const label = createElement("label", "vp-label", title);
	const input = createElement("input", "vp-input") as HTMLInputElement;
	input.type = type;
	input.placeholder = placeholder;
	input.required = true;
	label.appendChild(input);
	return { label, input };
}

function labeledTextarea(title: string, placeholder: string) {
	const label = createElement("label", "vp-label", title);
	const input = createElement("textarea", "vp-textarea") as HTMLTextAreaElement;
	input.placeholder = placeholder;
	label.appendChild(input);
	return { label, input };
}

function sortByDate(maps: PlatformMap[]) {
	return [...maps].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

function sortByObjects(maps: PlatformMap[]) {
	return [...maps].sort((a, b) => b.objectCount - a.objectCount || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

function getInitials(name: string) {
	return name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase() || "")
		.join("") || "V";
}

function cleanup(hiddenStates: Map<string, string | null>) {
	hiddenStates.forEach((display, id) => {
		const el = document.getElementById(id);
		if (!el) return;
		el.style.display = display ?? "";
	});
}
