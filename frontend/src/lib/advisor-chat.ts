export const ADVISOR_CHAT_OPEN = "smtravel:open-advisor-chat";

export function openAdvisorChat() {
  window.dispatchEvent(new CustomEvent(ADVISOR_CHAT_OPEN));
}
