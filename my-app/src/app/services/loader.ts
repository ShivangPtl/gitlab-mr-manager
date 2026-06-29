import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class LoaderService {
  private _count = 0;
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private messageSubject = new BehaviorSubject<string>('Loading...');
  private loaderTypeSubject = new BehaviorSubject<'spinner' | 'dots' | 'pulse'>('spinner');

  loading$: Observable<boolean> = this.loadingSubject.asObservable();
  message$: Observable<string> = this.messageSubject.asObservable();
  loaderType$: Observable<'spinner' | 'dots' | 'pulse'> = this.loaderTypeSubject.asObservable();

  showLoading(message = 'Loading...', type: 'spinner' | 'dots' | 'pulse' = 'spinner'): void {
    this._count++;
    this.messageSubject.next(message);
    this.loaderTypeSubject.next(type);
    this.loadingSubject.next(true);
  }

  hide(): void {
    this._count = Math.max(0, this._count - 1);
    if (this._count === 0) {
      this.loadingSubject.next(false);
    }
  }

  /** Force-hide regardless of count. Use only on error paths. */
  forceHide(): void {
    this._count = 0;
    this.loadingSubject.next(false);
  }
}