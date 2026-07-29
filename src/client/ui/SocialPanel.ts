import { apiFetch } from "../platform/api";
import { createElement, createButton, createIcon } from "./platform/dom";
import type { StoredAuthSession } from "../platform/auth";
import type { Router } from "../routing/Router";

const STYLE_ID = "viperio-social-panel-styles";

function injectSocialStyles() {
	if (document.getElementById(STYLE_ID)) return;
	const style = document.createElement("style");
	style.id = STYLE_ID;
	style.textContent = `
		.vp-social-panel {
			display: flex;
			flex-direction: column;
			gap: 16px;
			padding: 20px;
			background: rgba(17, 19, 27, 0.86);
			border: 1px solid var(--vp-border);
			border-radius: var(--vp-radius);
			min-width: 0;
			margin-bottom: 16px;
		}
		.vp-social-header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 8px;
			border-bottom: 1px solid var(--vp-border);
			padding-bottom: 12px;
		}
		.vp-social-title {
			margin: 0;
			font-size: 16px;
			font-weight: 950;
			color: var(--vp-text);
		}
		.vp-social-status-select {
			background: var(--vp-panel-2);
			color: var(--vp-text);
			border: 1px solid var(--vp-border);
			border-radius: 6px;
			padding: 4px 8px;
			font-size: 12px;
			font-weight: 800;
			outline: none;
			cursor: pointer;
		}
		.vp-social-tabs {
			display: flex;
			gap: 8px;
			background: rgba(0, 0, 0, 0.2);
			border-radius: 6px;
			padding: 4px;
		}
		.vp-social-tab-btn {
			flex: 1;
			background: transparent;
			border: 0;
			color: var(--vp-muted);
			font-weight: 800;
			font-size: 13px;
			padding: 6px 0;
			cursor: pointer;
			border-radius: 4px;
			transition: all 0.2s ease;
			text-align: center;
		}
		.vp-social-tab-btn.is-active {
			background: var(--vp-purple);
			color: var(--vp-text);
			box-shadow: 0 2px 10px rgba(139, 92, 246, 0.3);
		}
		.vp-social-input-row {
			display: flex;
			gap: 8px;
		}
		.vp-social-input {
			flex: 1;
			background: rgba(255, 255, 255, 0.05);
			border: 1px solid var(--vp-border);
			color: var(--vp-text);
			border-radius: 6px;
			padding: 8px 12px;
			font-size: 13px;
			outline: none;
			min-width: 0;
		}
		.vp-social-input:focus {
			border-color: var(--vp-purple);
		}
		.vp-social-add-btn {
			background: var(--vp-purple);
			border: 0;
			color: var(--vp-text);
			border-radius: 6px;
			padding: 0 12px;
			font-size: 13px;
			font-weight: 800;
			cursor: pointer;
			display: flex;
			align-items: center;
			justify-content: center;
		}
		.vp-social-list {
			display: flex;
			flex-direction: column;
			gap: 10px;
			max-height: 280px;
			overflow-y: auto;
			padding-right: 4px;
			margin-top: 10px;
		}
		.vp-social-list::-webkit-scrollbar {
			width: 6px;
		}
		.vp-social-list::-webkit-scrollbar-thumb {
			background: rgba(255, 255, 255, 0.1);
			border-radius: 3px;
		}
		.vp-social-item {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 10px;
			background: rgba(255, 255, 255, 0.02);
			border: 1px solid rgba(255, 255, 255, 0.04);
			border-radius: 6px;
			padding: 8px 10px;
			min-width: 0;
		}
		.vp-social-info {
			display: flex;
			align-items: center;
			gap: 8px;
			min-width: 0;
			flex: 1;
		}
		.vp-social-presence-dot {
			width: 10px;
			height: 10px;
			border-radius: 50%;
			flex: 0 0 auto;
			background: var(--vp-subtle);
		}
		.vp-social-presence-dot.online {
			background: var(--vp-green);
			box-shadow: 0 0 8px var(--vp-green);
		}
		.vp-social-presence-dot.dnd {
			background: var(--vp-red);
			box-shadow: 0 0 8px var(--vp-red);
		}
		.vp-social-name-col {
			display: flex;
			flex-direction: column;
			min-width: 0;
		}
		.vp-social-displayname {
			font-weight: 800;
			font-size: 13px;
			color: var(--vp-text);
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}
		.vp-social-username {
			font-size: 11px;
			color: var(--vp-muted);
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}
		.vp-social-status-text {
			font-size: 10px;
			font-weight: 700;
			color: var(--vp-cyan);
		}
		.vp-social-actions {
			display: flex;
			gap: 4px;
			flex-shrink: 0;
		}
		.vp-social-action-btn {
			background: rgba(255, 255, 255, 0.05);
			border: 1px solid var(--vp-border);
			color: var(--vp-text);
			border-radius: 4px;
			width: 28px;
			height: 28px;
			display: grid;
			place-items: center;
			cursor: pointer;
			transition: all 0.2s ease;
		}
		.vp-social-action-btn:hover {
			background: rgba(139, 92, 246, 0.2);
			border-color: var(--vp-purple);
		}
		.vp-social-action-btn.danger:hover {
			background: rgba(255, 65, 93, 0.2);
			border-color: var(--vp-red);
		}
		.vp-social-empty {
			font-size: 12px;
			color: var(--vp-muted);
			text-align: center;
			padding: 16px 0;
		}
		.vp-social-toast {
			font-size: 12px;
			color: #fde68a;
			text-align: center;
			min-height: 18px;
			word-break: break-word;
		}

		/* Global Floating Invite Toasts */
		.vp-social-invite-container {
			position: fixed;
			bottom: 24px;
			right: 24px;
			z-index: 9999;
			display: flex;
			flex-direction: column;
			gap: 12px;
			pointer-events: none;
		}
		.vp-social-invite-card {
			pointer-events: auto;
			width: 320px;
			background: rgba(17, 19, 27, 0.95);
			border: 1px solid var(--vp-purple);
			border-radius: var(--vp-radius);
			box-shadow: 0 10px 30px rgba(0,0,0,0.5), 0 0 20px rgba(139, 92, 246, 0.2);
			padding: 16px;
			display: flex;
			flex-direction: column;
			gap: 12px;
			backdrop-filter: blur(12px);
			animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
		}
		@keyframes slideIn {
			from { transform: translateX(100%) translateY(20px); opacity: 0; }
			to { transform: translateX(0) translateY(0); opacity: 1; }
		}
		.vp-social-invite-title {
			margin: 0;
			font-size: 14px;
			font-weight: 950;
			color: var(--vp-purple);
			display: flex;
			align-items: center;
			gap: 6px;
		}
		.vp-social-invite-msg {
			font-size: 13px;
			color: var(--vp-text);
			line-height: 1.4;
		}
		.vp-social-invite-actions {
			display: flex;
			gap: 8px;
		}
		.vp-social-invite-btn {
			flex: 1;
			height: 32px;
			border: 0;
			border-radius: 4px;
			font-size: 12px;
			font-weight: 800;
			cursor: pointer;
		}
		.vp-social-invite-btn.accept {
			background: var(--vp-purple);
			color: var(--vp-text);
		}
		.vp-social-invite-btn.decline {
			background: rgba(255, 255, 255, 0.1);
			color: var(--vp-muted);
			border: 1px solid var(--vp-border);
		}
		.vp-social-invite-progress {
			height: 3px;
			background: var(--vp-purple);
			width: 100%;
			transform-origin: left;
			animation: shrinkProgress 30s linear forwards;
		}
		@keyframes shrinkProgress {
			from { transform: scaleX(1); }
			to { transform: scaleX(0); }
		}
	`;
	document.head.appendChild(style);
}

interface FriendInfo {
	id: string;
	username: string;
	displayName?: string | null;
	status: "ONLINE" | "DND" | "OFFLINE";
	roomId?: string | null;
}

interface RequestInfo {
	id: string;
	sender: {
		id: string;
		username: string;
		displayName?: string | null;
	};
}

// Module-level persistent state to prevent reconnection on Lobby screen refresh
let socket: WebSocket | null = null;
let socketAuthToken: string | null = null;
let reconnectTimer: number | null = null;
let friends: FriendInfo[] = [];
let requests: RequestInfo[] = [];
let presenceStatus = "ONLINE";
let activeUIUpdateCallback: (() => void) | null = null;
let activeToastCallback: ((msg: string) => void) | null = null;
let globalRouter: Router | null = null;

export function closeSocialSocket() {
	if (socket) {
		socket.close();
		socket = null;
	}
	if (reconnectTimer) {
		window.clearTimeout(reconnectTimer);
		reconnectTimer = null;
	}
	socketAuthToken = null;
	activeUIUpdateCallback = null;
	activeToastCallback = null;
	document.getElementById("vp-social-invite-container")?.remove();
}

function handleSocketMessage(msg: any) {
	switch (msg.type) {
		case "friends_status_init": {
			const onlineMap = new Map<string, any>();
			msg.friends.forEach((friend: any) => {
				onlineMap.set(friend.id, friend);
			});

			friends.forEach(f => {
				const onlineData = onlineMap.get(f.id);
				if (onlineData) {
					f.status = onlineData.status;
					f.roomId = onlineData.roomId;
				} else {
					f.status = "OFFLINE";
					f.roomId = null;
				}
			});
			if (activeUIUpdateCallback) activeUIUpdateCallback();
			break;
		}

		case "friend_connected": {
			const f = friends.find(item => item.id === msg.friend.id);
			if (f) {
				f.status = msg.friend.status;
				f.roomId = msg.friend.roomId;
			} else {
				friends.push({
					id: msg.friend.id,
					username: msg.friend.username,
					displayName: msg.friend.displayName,
					status: msg.friend.status,
					roomId: msg.friend.roomId
				});
			}
			if (activeUIUpdateCallback) activeUIUpdateCallback();
			break;
		}

		case "friend_disconnected": {
			const f = friends.find(item => item.id === msg.userId);
			if (f) {
				f.status = "OFFLINE";
				f.roomId = null;
			}
			if (activeUIUpdateCallback) activeUIUpdateCallback();
			break;
		}

		case "game_invite_received": {
			showFloatingInvite(msg.invite);
			break;
		}

		case "game_invite_accepted": {
			if (globalRouter) {
				globalRouter.navigate("play", msg.roomId);
			}
			break;
		}

		case "game_invite_error": {
			if (activeToastCallback) {
				activeToastCallback(msg.error || "Error de invitación.");
			}
			break;
		}
	}
}

function showFloatingInvite(invite: any) {
	let container = document.getElementById("vp-social-invite-container");
	if (!container) {
		container = createElement("div", "vp-social-invite-container");
		container.id = "vp-social-invite-container";
		document.body.appendChild(container);
	}

	const card = createElement("div", "vp-social-invite-card");

	const title = createElement("h4", "vp-social-invite-title");
	const icon = document.createElement("iconify-icon");
	icon.setAttribute("icon", "mdi:gamepad-variant");
	title.appendChild(icon);
	const titleText = document.createElement("span");
	titleText.textContent = "Invitación de Juego";
	title.appendChild(titleText);
	card.appendChild(title);

	const msg = createElement("p", "vp-social-invite-msg");
	msg.textContent = `${invite.senderUsername} te invita a jugar en ${invite.mapName}.`;
	card.appendChild(msg);

	const progress = createElement("div", "vp-social-invite-progress");
	card.appendChild(progress);

	const actions = createElement("div", "vp-social-invite-actions");
	const acceptBtn = createButton("vp-social-invite-btn accept", "Aceptar", () => {
		if (socket && socket.readyState === WebSocket.OPEN) {
			socket.send(JSON.stringify({
				type: "acceptGameInvite",
				inviteId: invite.id
			}));
		}
		card.remove();
	});
	const declineBtn = createButton("vp-social-invite-btn decline", "Rechazar", () => {
		card.remove();
	});
	actions.appendChild(acceptBtn);
	actions.appendChild(declineBtn);
	card.appendChild(actions);

	container.appendChild(card);

	setTimeout(() => {
		card.remove();
	}, 30000);
}

export function renderSocialPanel(
	container: HTMLElement,
	auth: StoredAuthSession,
	router: Router
): () => void {
	injectSocialStyles();
	globalRouter = router;

	let currentTab: "friends" | "requests" = "friends";
	let toastTimeout: number | null = null;

	// Build main container structure
	const panel = createElement("div", "vp-social-panel");
	container.appendChild(panel);

	const header = createElement("div", "vp-social-header");
	header.appendChild(createElement("h3", "vp-social-title", "Social"));

	const presenceSelect = createElement("select", "vp-social-status-select") as HTMLSelectElement;
	const optOnline = createElement("option", "", "Online");
	optOnline.value = "ONLINE";
	const optDnd = createElement("option", "", "No molestar");
	optDnd.value = "DND";
	const optInvisible = createElement("option", "", "Invisible");
	optInvisible.value = "INVISIBLE";
	presenceSelect.appendChild(optOnline);
	presenceSelect.appendChild(optDnd);
	presenceSelect.appendChild(optInvisible);
	header.appendChild(presenceSelect);
	panel.appendChild(header);

	// Tabs
	const tabs = createElement("div", "vp-social-tabs");
	const tabFriends = createButton("vp-social-tab-btn is-active", "Amigos", () => switchTab("friends"));
	const tabRequests = createButton("vp-social-tab-btn", "Solicitudes", () => switchTab("requests"));
	tabs.appendChild(tabFriends);
	tabs.appendChild(tabRequests);
	panel.appendChild(tabs);

	// Content area
	const contentArea = createElement("div");
	panel.appendChild(contentArea);

	const toastEl = createElement("div", "vp-social-toast");
	panel.appendChild(toastEl);

	const showToast = (msg: string) => {
		toastEl.textContent = msg;
		if (toastTimeout) window.clearTimeout(toastTimeout);
		toastTimeout = window.setTimeout(() => {
			toastEl.textContent = "";
		}, 4000);
	};

	activeToastCallback = showToast;

	// Setup WebSocket connection (if not already connected with correct token)
	if (!socket || socketAuthToken !== auth.session.token) {
		closeSocialSocket();

		socketAuthToken = auth.session.token;
		const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
		const hostname = window.location.hostname || "localhost";
		const wsUrl = `${protocol}//${hostname}:8080`;

		const connect = () => {
			try {
				socket = new WebSocket(wsUrl);

				socket.onopen = () => {
					console.log("[Social WebSocket] Connected");
					socket?.send(JSON.stringify({
						type: "joinRoom",
						roomId: "lobby",
						playerName: auth.user.displayName || auth.user.username,
						token: auth.session.token
					}));
				};

				socket.onmessage = (event) => {
					try {
						const data = JSON.parse(event.data);
						handleSocketMessage(data);
					} catch (err) {
						console.error("[Social WebSocket] Error parsing message:", err);
					}
				};

				socket.onclose = () => {
					console.log("[Social WebSocket] Disconnected. Reconnecting in 5s...");
					reconnectTimer = window.setTimeout(connect, 5000);
				};

				socket.onerror = (err) => {
					console.error("[Social WebSocket] Error:", err);
				};
			} catch (err) {
				console.error("[Social WebSocket] Failed connection setup:", err);
			}
		};

		connect();
	}

	// Fetch lists (non-blocking)
	const fetchListData = async () => {
		try {
			const [friendsRes, requestsRes] = await Promise.all([
				apiFetch<{ friends: any[] }>("/social/friends"),
				apiFetch<{ requests: any[] }>("/social/friends/requests"),
			]);

			// Preserve online statuses from current WS state
			const activeStatusMap = new Map<string, { status: "ONLINE" | "DND" | "OFFLINE", roomId?: string | null }>();
			friends.forEach(f => {
				activeStatusMap.set(f.id, { status: f.status, roomId: f.roomId });
			});

			friends = friendsRes.friends.map(f => {
				const active = activeStatusMap.get(f.friend.id);
				return {
					id: f.friend.id,
					username: f.friend.username,
					displayName: f.friend.displayName,
					status: active ? active.status : "OFFLINE",
					roomId: active ? active.roomId : null
				};
			});

			requests = requestsRes.requests;
			renderContent();
		} catch (err) {
			console.error("[Social] Failed fetching initial data:", err);
		}
	};

	void fetchListData();

	// Read initial status preference from localStorage or default ONLINE
	presenceStatus = localStorage.getItem(`presence:status:${auth.user.id}`) || "ONLINE";
	presenceSelect.value = presenceStatus;

	presenceSelect.onchange = async () => {
		const newStatus = presenceSelect.value;
		presenceStatus = newStatus;
		localStorage.setItem(`presence:status:${auth.user.id}`, newStatus);

		try {
			await apiFetch("/presence/status", {
				method: "POST",
				body: JSON.stringify({ status: newStatus })
			});

			if (socket && socket.readyState === WebSocket.OPEN) {
				socket.send(JSON.stringify({
					type: "changePresence",
					status: newStatus
				}));
			}
			showToast(`Estado cambiado a ${newStatus}`);
		} catch (err) {
			console.error("[Social] Error setting status:", err);
			showToast("No se pudo actualizar el estado.");
		}
	};

	const switchTab = (tab: "friends" | "requests") => {
		currentTab = tab;
		if (tab === "friends") {
			tabFriends.classList.add("is-active");
			tabRequests.classList.remove("is-active");
		} else {
			tabFriends.classList.remove("is-active");
			tabRequests.classList.add("is-active");
		}
		renderContent();
	};

	const renderContent = () => {
		contentArea.replaceChildren();

		if (currentTab === "friends") {
			const addRow = createElement("div", "vp-social-input-row");
			const input = createElement("input", "vp-social-input") as HTMLInputElement;
			input.placeholder = "Agregar por username...";
			const addBtn = createElement("button", "vp-social-add-btn", "Agregar");
			addBtn.onclick = async () => {
				const username = input.value.trim();
				if (!username) return;
				addBtn.disabled = true;
				try {
					await apiFetch("/social/friends/request", {
						method: "POST",
						body: JSON.stringify({ username })
					});
					showToast(`Solicitud enviada a ${username}`);
					input.value = "";
				} catch (err) {
					showToast(err instanceof Error ? err.message : "Error enviando solicitud");
				} finally {
					addBtn.disabled = false;
				}
			};
			addRow.appendChild(input);
			addRow.appendChild(addBtn);
			contentArea.appendChild(addRow);

			const list = createElement("div", "vp-social-list");
			if (friends.length === 0) {
				list.appendChild(createElement("div", "vp-social-empty", "No tienes amigos agregados aún."));
			} else {
				const sortedFriends = [...friends].sort((a, b) => {
					const order = { ONLINE: 0, DND: 1, OFFLINE: 2 };
					return order[a.status] - order[b.status];
				});

				sortedFriends.forEach(f => {
					const item = createElement("div", "vp-social-item");

					const info = createElement("div", "vp-social-info");
					const dot = createElement("div", "vp-social-presence-dot");
					if (f.status === "ONLINE") dot.classList.add("online");
					if (f.status === "DND") dot.classList.add("dnd");
					info.appendChild(dot);

					const nameCol = createElement("div", "vp-social-name-col");
					const displayNameEl = createElement("span", "vp-social-displayname");
					displayNameEl.textContent = f.displayName || f.username;
					nameCol.appendChild(displayNameEl);

					const usernameEl = createElement("span", "vp-social-username");
					usernameEl.textContent = `@${f.username}`;
					nameCol.appendChild(usernameEl);

					if (f.status !== "OFFLINE") {
						const statusEl = createElement("span", "vp-social-status-text");
						statusEl.textContent = f.roomId ? "En partida" : "En catálogo";
						nameCol.appendChild(statusEl);
					}

					info.appendChild(nameCol);
					item.appendChild(info);

					const actions = createElement("div", "vp-social-actions");

					if (f.roomId) {
						const joinBtn = createElement("button", "vp-social-action-btn") as HTMLButtonElement;
						joinBtn.title = "Unirse a partida";
						const icon = document.createElement("iconify-icon");
						icon.setAttribute("icon", "mdi:play");
						joinBtn.appendChild(icon);
						joinBtn.onclick = () => {
							if (f.roomId) router.navigate("play", f.roomId);
						};
						actions.appendChild(joinBtn);
					}

					const inviteBtn = createElement("button", "vp-social-action-btn") as HTMLButtonElement;
					inviteBtn.title = "Invitar a jugar";
					const iconInv = document.createElement("iconify-icon");
					iconInv.setAttribute("icon", "mdi:plus-circle");
					inviteBtn.appendChild(iconInv);
					inviteBtn.onclick = () => {
						const userRoomId = router.getRoomId();
						if (!userRoomId || userRoomId === "lobby") {
							showToast("Primero entra a una partida o mapa para invitar.");
							return;
						}
						if (socket && socket.readyState === WebSocket.OPEN) {
							socket.send(JSON.stringify({
								type: "sendGameInvite",
								targetUserId: f.id,
								roomId: userRoomId
							}));
							showToast(`Invitación enviada a ${f.displayName || f.username}`);
						} else {
							showToast("Error de conexión, intenta más tarde.");
						}
					};
					actions.appendChild(inviteBtn);

					const deleteBtn = createElement("button", "vp-social-action-btn danger") as HTMLButtonElement;
					deleteBtn.title = "Eliminar amigo";
					const iconDel = document.createElement("iconify-icon");
					iconDel.setAttribute("icon", "mdi:trash-can");
					deleteBtn.appendChild(iconDel);
					deleteBtn.onclick = async () => {
						if (!confirm(`¿Eliminar a ${f.displayName || f.username} de tus amigos?`)) return;
						try {
							await apiFetch(`/social/friends/${f.id}`, { method: "DELETE" });
							friends = friends.filter(item => item.id !== f.id);
							renderContent();
							showToast("Amigo eliminado");
						} catch (err) {
							showToast("No se pudo eliminar amigo");
						}
					};
					actions.appendChild(deleteBtn);

					item.appendChild(actions);
					list.appendChild(item);
				});
			}
			contentArea.appendChild(list);

		} else {
			const list = createElement("div", "vp-social-list");
			if (requests.length === 0) {
				list.appendChild(createElement("div", "vp-social-empty", "No hay solicitudes pendientes."));
			} else {
				requests.forEach(r => {
					const item = createElement("div", "vp-social-item");

					const info = createElement("div", "vp-social-info");
					const nameCol = createElement("div", "vp-social-name-col");
					const displayNameEl = createElement("span", "vp-social-displayname");
					displayNameEl.textContent = r.sender.displayName || r.sender.username;
					nameCol.appendChild(displayNameEl);

					const usernameEl = createElement("span", "vp-social-username");
					usernameEl.textContent = `@${r.sender.username}`;
					nameCol.appendChild(usernameEl);

					info.appendChild(nameCol);
					item.appendChild(info);

					const actions = createElement("div", "vp-social-actions");

					const acceptBtn = createElement("button", "vp-social-action-btn") as HTMLButtonElement;
					acceptBtn.title = "Aceptar solicitud";
					const iconAcc = document.createElement("iconify-icon");
					iconAcc.setAttribute("icon", "mdi:check");
					acceptBtn.appendChild(iconAcc);
					acceptBtn.onclick = async () => {
						try {
							await apiFetch(`/social/friends/request/${r.id}/accept`, { method: "PUT" });
							requests = requests.filter(req => req.id !== r.id);
							void fetchListData();
							showToast("Solicitud aceptada");
						} catch (err) {
							showToast("Error al aceptar solicitud");
						}
					};
					actions.appendChild(acceptBtn);

					const rejectBtn = createElement("button", "vp-social-action-btn danger") as HTMLButtonElement;
					rejectBtn.title = "Rechazar solicitud";
					const iconRej = document.createElement("iconify-icon");
					iconRej.setAttribute("icon", "mdi:close");
					rejectBtn.appendChild(iconRej);
					rejectBtn.onclick = async () => {
						try {
							await apiFetch(`/social/friends/request/${r.id}/reject`, { method: "PUT" });
							requests = requests.filter(req => req.id !== r.id);
							renderContent();
							showToast("Solicitud rechazada");
						} catch (err) {
							showToast("Error al rechazar solicitud");
						}
					};
					actions.appendChild(rejectBtn);

					item.appendChild(actions);
					list.appendChild(item);
				});
			}
			contentArea.appendChild(list);
		}
	};

	activeUIUpdateCallback = renderContent;
	renderContent();

	return () => {
		activeUIUpdateCallback = null;
		activeToastCallback = null;
		if (toastTimeout) {
			window.clearTimeout(toastTimeout);
			toastTimeout = null;
		}
		panel.remove();
	};
}
