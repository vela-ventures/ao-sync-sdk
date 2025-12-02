import { createModalTemplate } from "../templates";
import { ModalStyles } from "../types";

export class ModalManager {
  private modal: HTMLDivElement | null;
  private approvalModal: HTMLDivElement | null;
  private isDarkMode: boolean;

  constructor(isDarkMode: boolean) {
    this.modal = null;
    this.approvalModal = null;
    this.isDarkMode = isDarkMode;
  }

  public createConnectionModal(
    qrCodeData: string,
    walletClient: any,
    styles?: ModalStyles
  ): void {
    const modal = createModalTemplate({
      subTitle: "Scan with your beacon wallet",
      qrCodeData,
      description: "Don't have beacon yet?",
      walletClient,
    });
    this.modal = modal;
  }

  public createApprovalModal(): void {
    if (this.approvalModal) return;

    const modal = createModalTemplate({
      subTitle: "Approval pending ...",
      description: " ",
      animationData: true,
    });

    this.approvalModal = modal;
  }

  public closeConnectionModal(): void {
    if (this.modal) {
      this.modal = null;
    }
  }

  public closeApprovalModal(): void {
    if (this.approvalModal) {
      this.approvalModal = null;
    }
  }

  public getApprovalModal(): HTMLDivElement | null {
    return this.approvalModal;
  }

  public getConnectionModal(): HTMLDivElement | null {
    return this.modal;
  }

  public setApprovalModal(modal: HTMLDivElement | null): void {
    this.approvalModal = modal;
  }
}
