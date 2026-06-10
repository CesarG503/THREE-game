import "iconify-icon";
import { Router } from "../routing/Router";
import { clearStoredAuth, getAuthDisplayName, getStoredAuth, type StoredAuthSession } from "../platform/auth";
import { createEmptyMapData } from "../platform/mapDefaults";
import { createMap, deleteMap, listMaps, type PlatformMap } from "../platform/api";
import { renderAuthScreen } from "./AuthScreen";
import { clampText, clear, createButton, createElement, createIcon, formatRelativeDate, prependIcon } from "./platform/dom";
import { injectPlatformStyles } from "./platform/styles";

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
	let query = "";
	let loading = true;
	let status = "";
	let authCleanup: (() => void) | null = null;
	let disposed = false;
	let unsubscribeRoute: () => void = () => {};

	const container = createElement("div", "vp-shell");
	container.id = "lobby-screen";
	document.body.appendChild(container);

	const disposeLobby = () => {
		if (disposed) return;
		disposed = true;
		if (authCleanup) authCleanup();
		unsubscribeRoute();
		container.remove();
		cleanup(hiddenStates);
	};

	const setStatus = (message: string) => {
		status = message;
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
	};

	const openAuth = () => {
		if (authCleanup) authCleanup();
		authCleanup = renderAuthScreen((nextAuth) => {
			auth = nextAuth;
			if (authCleanup) {
				authCleanup();
				authCleanup = null;
			}
			void refreshMaps();
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

	const navigateToMap = (mode: "play" | "editor", map: PlatformMap) => {
		router.navigate(mode, map.slug);
	};

	const switchView = (view: LobbyView) => {
		activeView = view;
		render();
	};

	const render = () => {
		if (disposed) return;
		if (router.getMode() !== "lobby") {
			disposeLobby();
			return;
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
			feed.appendChild(renderProfileView(auth, myMaps, openAuth));
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
				router.navigate("play");
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
			actions.appendChild(prependIcon(createButton("vp-secondary-btn vp-icon-btn", "Jugar sala libre", () => router.navigate("play")), "mdi:gamepad-variant"));
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
		card.appendChild(preview);
		card.appendChild(body);
		card.appendChild(edit);
		return card;
	};

	const renderMapCard = (map: PlatformMap, index: number) => {
		const card = createElement("article", "vp-map-card");
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
		actions.appendChild(prependIcon(createButton("vp-primary-btn vp-icon-btn", "Jugar", () => navigateToMap("play", map)), "mdi:play"));
		if (auth?.user.id === map.ownerId) {
			actions.appendChild(prependIcon(createButton("vp-secondary-btn vp-icon-btn", "Editar", () => navigateToMap("editor", map)), "mdi:pencil-box"));
		} else {
			actions.appendChild(prependIcon(createButton("vp-secondary-btn vp-icon-btn", "Ver sala", () => navigateToMap("play", map)), "mdi:eye"));
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
	side.appendChild(createElement("div", "vp-muted", "Mapa vacio · suelo 100x100 · cielo nocturno · listo para editor."));
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

function renderProfileView(
	auth: StoredAuthSession | null,
	myMaps: PlatformMap[],
	openAuth: () => void,
) {
	const section = createElement("section");
	section.appendChild(createElement("h1", "vp-section-title", "Mi perfil"));
	const panel = createElement("div", "vp-panel");

	if (!auth) {
		panel.appendChild(createElement("div", "vp-muted", "Sesion de invitado"));
		panel.appendChild(prependIcon(createButton("vp-primary-btn vp-icon-btn", "Entrar", openAuth), "mdi:login"));
	} else {
		panel.appendChild(createElement("h2", "vp-map-title", getAuthDisplayName(auth)));
		panel.appendChild(createElement("div", "vp-muted", auth.user.email));
		panel.appendChild(createElement("div", "vp-muted", `${myMaps.length} mapas guardados`));
		panel.appendChild(prependIcon(createButton("vp-danger-btn vp-icon-btn", "Cerrar sesion", () => {
			clearStoredAuth();
			window.location.reload();
		}), "mdi:logout"));
	}

	section.appendChild(panel);
	return section;
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
