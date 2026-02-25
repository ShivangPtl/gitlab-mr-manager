import { Injectable } from '@angular/core';

declare const window: any;

@Injectable({ providedIn: 'root' })
export class AiService {

  async generateMultiMRDescription(payload: any) {
    return await window.electronAPI
      .generateMultiMRDescription(payload);
  }

  async generateMultiCodeReview(payload: any) {
    return await window.electronAPI
      .generateMultiCodeReview(payload);
  }

  async generateMRReview(payload: any) {
    return await
      window.electronAPI
        .generateMRReview(payload);
  }

}