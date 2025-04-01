import { modalStyles, mobileStylesCSS } from "../styles/modalStyles";
import { ICONS } from "../constants/modalAssets";
import { objectToInlineStyle } from "../utils/styleUtils";

export interface ModalTemplateProps {
  subTitle: string;
  description?: string;
  qrCodeData?: string;
  animationData?: any;
  autoClose?: boolean;
  walletClient?: any;
}

const modalCSS = `
  .aosync-modal-fade-in {
    animation: fadeIn 0.1s ease;
  }
  .aosync-modal-fade-out {
    animation: fadeOut 0.2s ease;
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes fadeOut {
    from { opacity: 1; }
    to { opacity: 0; }
  }
`;

export const createModalTemplate = ({
  subTitle,
  description,
  qrCodeData,
  animationData,
  autoClose,
  walletClient,
}: ModalTemplateProps) => {
  if (!document.getElementById("aosync-modal-styles")) {
    const style = document.createElement("style");
    style.id = "aosync-modal-styles";
    style.textContent = modalCSS + mobileStylesCSS;
    document.head.appendChild(style);
  }

  const modal = document.createElement("div");
  Object.assign(modal.style, modalStyles.modal);
  modal.className = "aosync-modal-fade-in";
  modal.id = `aosync-modal-container`;

  const backdrop = document.createElement("div");
  Object.assign(backdrop.style, modalStyles.backdrop);
  backdrop.onclick = () => closeModal(modal, walletClient);

  const content = document.createElement("div");
  Object.assign(content.style, modalStyles.content);
  content.style.setProperty("font-family", "Sora", "important");
  content.id = "aosync-modal-content";

  content.innerHTML = `
     <div style="${objectToInlineStyle(modalStyles.iconContainer)}">
      ${ICONS.qrCode.scanner}
     </div>
     <h3 style="${objectToInlineStyle(modalStyles.title)}">AOSync</h3>
     <div style="${objectToInlineStyle(modalStyles.subtitle)}">${subTitle}</div>
     ${
       qrCodeData
         ? `<img id="aosync-beacon-connection-qrCode" src="${qrCodeData}" alt="QR Code" style="width: 200px; height: 200px; margin-bottom: 10px;">`
         : ""
     }
     ${
       animationData
         ? '<div id="aosync-lottie-animation" style="width: 200px; height: 200px; margin-bottom: 10px;"></div>'
         : ""
     }
     <div style="${objectToInlineStyle(modalStyles.description)}">
       <span id="aosync-beacon-modal-description">${description}</span>
       <a href="https://beaconwallet.app" target="_blank" style="${objectToInlineStyle(modalStyles.modalLink)}; text-decoration: none; display: block; margin-top: 8px;">
         beaconwallet.app
       </a>
     </div>
  `;

  modal.appendChild(backdrop);
  modal.appendChild(content);
  document.body.appendChild(modal);

  if (animationData) {
    const lottieContainer = document.getElementById("aosync-lottie-animation");
    if (lottieContainer) {
      const img = document.createElement("img");
      img.src = ICONS.loadingAnimation;
      img.style.width = "100%";
      lottieContainer.appendChild(img);
    }
  }

  if (autoClose) {
    setTimeout(() => {
      closeModal(modal);
      if (document.getElementById("aosync-modal-container")) {
        document.body.removeChild(document.getElementById("aosync-modal-container"));
      }
    }, 1000);
  }

  return modal;
};

function closeModal(modal: HTMLElement, walletClient?: any) {
  if (walletClient) {
    walletClient.connectionListener("connection_canceled");
  }
  modal.className = "aosync-modal-fade-out";
  setTimeout(() => modal.remove(), 150);
}

export function connectionModalMessage(modalMessage: "success" | "fail"): void {
  const qrCode =
    document.getElementById("aosync-beacon-connection-qrCode") ||
    document.getElementById("aosync-lottie-animation");

  if (!qrCode) return;

  const modal = document.getElementById("aosync-modal-container");
  if (!modal) return;

  const statusMark = document.createElement("div");
  Object.assign(statusMark.style, modalStyles.statusMark);
  statusMark.className = "aosync-modal-fade-in";

  statusMark.innerHTML =
    modalMessage === "success" ? ICONS.qrCode.success : ICONS.qrCode.fail;

  qrCode.replaceWith(statusMark);

  setTimeout(() => closeModal(modal), 1000);
}
