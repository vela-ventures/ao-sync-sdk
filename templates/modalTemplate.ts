import Lottie from 'lottie-web';

export const createModalTemplate = ({
  encodedPattern,
  subTitle,
  description,
  qrCodeData,
  animationData,
}: {
  encodedPattern: string;
  subTitle: string;
  description?: string;
  qrCodeData?: string;
  animationData?: any;
}) => {
  const modal = document.createElement('div');
  Object.assign(modal.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: '999999',
  });

  // Create modal content
  const content = document.createElement('div');
  Object.assign(content.style, {
    background: 'white',
    borderRadius: '16px',
    padding: '28px',
    paddingTop: '47px',
    textAlign: 'center',
    minWidth: '300px',
    fontFamily: 'Sora',
    display: 'flex',
    justifyContent: 'center',
    flexDirection: 'column',
    alignItems: 'center',
    backgroundRepeat: 'no-repeat',
  });

  content.style.backgroundImage = `url(${
    'data:image/svg+xml;base64,' + encodedPattern
  })`;

  content.innerHTML = `
     <div style="width: 50px; height: 50px; border-radius: 50%; background-color: #F7FAFD; margin-bottom: 12px; display: flex; justify-content: center; align-items: center">
      <svg width="16" height="15" viewBox="0 0 16 15" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M1 0.8H0.8V1V4.40476V4.60476H1H1.66667H1.86667V4.40476V1.81905H4.66667H4.86667V1.61905V1V0.8H4.66667H1ZM11.3333 0.8H11.1333V1V1.61905V1.81905H11.3333H14.1333V4.40476V4.60476H14.3333H15H15.2V4.40476V1V0.8H15H11.3333ZM1 10.3952H0.8V10.5952V14V14.2H1H4.66667H4.86667V14V13.381V13.181H4.66667H1.86667V10.5952V10.3952H1.66667H1ZM14.3333 10.3952H14.1333V10.5952V13.181H11.3333H11.1333V13.381V14V14.2H11.3333H15H15.2V14V10.5952V10.3952H15H14.3333Z" fill="black" stroke="black" stroke-width="0.4"/>
      </svg>
      </div>
      <h3 style="color: #000; font-size: 18px; font-weight: 500; margin-bottom: 5px; margin-top: 0px">AOSync</h3>
      <div style="font-size: 14px; color: #2B2B2B; margin-bottom: 2px;">${subTitle}</div>
      ${
        qrCodeData &&
        `<img id="aosync-beacon-connection-qrCode" src="${qrCodeData}" alt="QR Code" style="width: 200px; height: 200px; margin-bottom: 10px;">`
      }
      ${
        animationData &&
        '<div id="aosync-lottie-animation" style="width: 200px; height: 200px; margin-bottom: 10px;"></div>'
      }
      <div style="font-size: 11px; color: #2B2B2B;">
        <span id="aosync-beacon-modal-description">${description}</span>
        <a href="https://beaconwallet.app" 
           target="_blank" 
           style="color: #09084B; text-decoration: none; display: block; margin-top: 8px;">
          beaconwallet.com
        </a>
      </div>
    `;
  modal.appendChild(content);
  document.body.appendChild(modal);

  if (animationData) {
    const lottieContainer = document.getElementById('aosync-lottie-animation');
    if (lottieContainer) {
      try {
        Lottie.loadAnimation({
          container: lottieContainer,
          renderer: 'svg',
          loop: true,
          autoplay: true,
          path: '../paperplane.json',
          animationData: animationData,
        });
      } catch (error) {
        console.log(error);
      }
    }
  }
  return modal;
};
