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
    background: "white",
    borderRadius: "16px",
    padding: "28px",
    paddingTop: "47px",
    textAlign: "center",
    minWidth: "364px",
    display: "flex",
    justifyContent: "center",
    flexDirection: "column",
    alignItems: "center",
    backgroundRepeat: "no-repeat",
    zIndex: "10",
    boxSizing: "border-box",
    backgroundImage:
      "url(https://arweave.net/zNeeL2prnXwctfwCo07xyhT8ob-M6F70RgYObK51Y90)",
  },

  iconContainer: {
    width: "50px",
    height: "50px",
    borderRadius: "50%",
    backgroundColor: "#F7FAFD",
    marginBottom: "12px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },

  title: {
    color: "#000",
    fontSize: "18px",
    fontWeight: "500",
    marginBottom: "5px",
    marginTop: "0px",
    fontFamily: "Sora",
  },

  subtitle: {
    fontSize: "14px",
    color: "#2B2B2B",
    marginBottom: "2px",
  },

  description: {
    fontSize: "11px",
    color: "#2B2B2B",
    fontFamily: "Sora",
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
};

if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    // modalStyles.content.backgroundColor = "#0A0B19"
}

export const mobileStylesCSS = `
    @media (max-width: 768px) {
      #aosync-modal-content {
        width: 100% !important;
        min-width: 100% !important;
        margin: 0 !important;
        border-radius: 16px 16px 0 0 !important;
        position: fixed !important;
        bottom: 0 !important;
        max-height: 90vh !important;
        overflow-y: auto !important;
        background-size: 100% !important;
      }
      #aosync-modal {
        align-items: flex-end !important;
      }
    }
  `;
