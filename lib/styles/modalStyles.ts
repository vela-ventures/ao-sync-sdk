export const modalStyles: any = {
  modal: {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: "999999",
  },

  backdrop: {
    position: "absolute",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },

  content: {
    background: "oklch(0.98 0 0)",
    borderRadius: "16px",
    padding: "24px",
    textAlign: "center",
    minWidth: "364px",
    maxWidth: "364px",
    display: "flex",
    justifyContent: "center",
    flexDirection: "column",
    alignItems: "center",
    zIndex: "10",
    boxSizing: "border-box",
  },

  iconContainer: {
    width: "50px",
    height: "50px",
    borderRadius: "50%",
    backgroundColor: "oklch(0.95 0.01 264)",
    marginBottom: "12px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },

  title: {
    color: "oklch(0.2 0 0)",
    fontSize: "18px",
    fontWeight: "400",
    marginBottom: "5px",
    marginTop: "0px",
    fontFamily: "ABC Diatype Variable Unlicensed Trial, sans-serif",
  },

  subtitle: {
    fontSize: "14px",
    fontWeight: "300",
    color: "oklch(0.4 0.01 264)",
    marginBottom: "2px",
    fontFamily: "ABC Diatype Variable Unlicensed Trial, sans-serif",
  },

  description: {
    fontSize: "11px",
    fontWeight: "300",
    color: "oklch(0.4 0.01 264)",
    fontFamily: "ABC Diatype Variable Unlicensed Trial, sans-serif",
  },

  statusMark: {
    width: "200px",
    height: "200px",
    marginBottom: "10px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: "30px",
    boxSizing: "border-box",
  },

  modalLink: {
    color: "oklch(0.45 0.25 264)",
  },
};

if (
  true
  // typeof window !== "undefined" &&
  // window?.matchMedia &&
  // window?.matchMedia("(prefers-color-scheme: dark)").matches
) {
  modalStyles.content.backgroundColor = "oklch(0.145 0 0)";
  modalStyles.iconContainer.backgroundColor = "oklch(0.205 0 0)";
  modalStyles.title.color = "oklch(0.985 0 0)";
  modalStyles.description.color = "oklch(0.6 0.01 264)";
  modalStyles.subtitle.color = "oklch(0.6 0.01 264)";
  modalStyles.modalLink.color = "oklch(0.985 0 0)";
  modalStyles.backdrop.backgroundColor = "rgba(0, 0, 0, 0.8)";
}

export const mobileStylesCSS = `
    @media (max-width: 768px) {
      #aosync-modal-content {
        width: 100% !important;
        min-width: 100% !important;
        margin: 0 !important;
        border-radius: 12px 12px 0 0 !important;
        position: fixed !important;
        bottom: 0 !important;
        max-height: 90vh !important;
        overflow-y: auto !important;
      }
      #aosync-modal {
        align-items: flex-end !important;
      }
    }
  `;
