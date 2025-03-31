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

export const createModalTemplate = ({
  subTitle,
  description,
  qrCodeData,
  animationData,
  autoClose,
  walletClient,
}: ModalTemplateProps) => {
  const modal = document.createElement("div");
  Object.assign(modal.style, modalStyles.modal);
  modal.id = "aosync-modal";

  const mobileStyles = document.createElement("style");
  mobileStyles.textContent = mobileStylesCSS;
  document.head.appendChild(mobileStyles);

  const backdrop = document.createElement("div");
  Object.assign(backdrop.style, modalStyles.backdrop);
  backdrop.id = "aosync-backdrop";
  backdrop.onclick = () => {
    if (walletClient) {
      walletClient.connectionListener("connection_canceled");
    }
    document.body.removeChild(modal);
  };

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
       <a href="https://beaconwallet.app" target="_blank" style="color: #09084B; text-decoration: none; display: block; margin-top: 8px;">
         beaconwallet.app
       </a>
     </div>
  `;

  modal.appendChild(backdrop);
  modal.appendChild(content);
  document.body.appendChild(modal);

  handleAnimationData(animationData);
  handleAutoClose(autoClose, modal);

  return modal;
};

function handleAnimationData(animationData: any) {
  if (animationData) {
    const lottieContainer = document.getElementById("aosync-lottie-animation");
    if (lottieContainer) {
      try {
        const img = document.createElement("img");
        img.src = ICONS.loadingAnimation;
        img.style.width = "100%";
        lottieContainer.appendChild(img);
      } catch (error) {
        console.log(error);
      }
    }
  }
}

function handleAutoClose(autoClose: boolean | undefined, modal: HTMLElement) {
  if (autoClose) {
    setTimeout(() => {
      if (document.getElementById("aosync-modal")) {
        document.body.removeChild(modal);
      }
    }, 1000);
  }
}

export function connectionModalMessage(modalMessage: "success" | "fail"): void {
  const qrCode =
    document.getElementById("aosync-beacon-connection-qrCode") ||
    document.getElementById("aosync-lottie-animation");

  const modal = document.getElementById("aosync-modal");

  const modalDescription = document.getElementById(
    "aosync-beacon-modal-description"
  );
  const statusMark = document.createElement("div");
  Object.assign(statusMark.style, modalStyles.statusMark);

  if (modalDescription) {
    modalDescription!.style.visibility = "hidden";
  }
  if (modalMessage === "success") {
    statusMark.innerHTML = ICONS.qrCode.success;
  } else {
    statusMark.innerHTML = ICONS.qrCode.fail;
  }
  qrCode?.replaceWith(statusMark);

  setTimeout(() => {
    document.body.removeChild(modal);
  }, 1000);
}
