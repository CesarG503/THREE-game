export function createElement<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	className?: string,
	text?: string,
) {
	const element = document.createElement(tag);
	if (className) element.className = className;
	if (text !== undefined) element.textContent = text;
	return element;
}

export function createButton(className: string, text: string, onClick: () => void) {
	const button = createElement("button", className, text);
	button.type = "button";
	button.onclick = onClick;
	return button;
}

export function createIcon(icon: string, className = "vp-icon") {
	const element = document.createElement("iconify-icon");
	element.setAttribute("icon", icon);
	element.setAttribute("aria-hidden", "true");
	element.className = className;
	return element;
}

export function prependIcon(element: HTMLElement, icon: string, className = "vp-icon") {
	element.prepend(createIcon(icon, className));
	return element;
}

export function clear(element: HTMLElement) {
	while (element.firstChild) element.firstChild.remove();
}

export function formatRelativeDate(value: string | number | Date) {
	const date = new Date(value);
	const diffMs = Date.now() - date.getTime();
	const diffMinutes = Math.max(0, Math.floor(diffMs / 60_000));
	if (diffMinutes < 1) return "Ahora";
	if (diffMinutes < 60) return `Hace ${diffMinutes} min`;
	const hours = Math.floor(diffMinutes / 60);
	if (hours < 24) return `Hace ${hours} h`;
	const days = Math.floor(hours / 24);
	if (days < 7) return `Hace ${days} d`;
	return date.toLocaleDateString();
}

export function clampText(value: string | null | undefined, fallback: string) {
	const text = value?.trim();
	return text || fallback;
}
