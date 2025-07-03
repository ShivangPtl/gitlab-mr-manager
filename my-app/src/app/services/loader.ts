// loader.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LoaderService {
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private messageSubject = new BehaviorSubject<string>('Loading...');
  private loaderTypeSubject = new BehaviorSubject<'spinner' | 'dots' | 'pulse'>('spinner');

  loading$: Observable<boolean> = this.loadingSubject.asObservable();
  message$: Observable<string> = this.messageSubject.asObservable();
  loaderType$: Observable<'spinner' | 'dots' | 'pulse'> = this.loaderTypeSubject.asObservable();

  show(message: string = 'Loading...', type: 'spinner' | 'dots' | 'pulse' = 'spinner'): void {
    this.messageSubject.next(message);
    this.loaderTypeSubject.next(type);
    this.loadingSubject.next(true);
  }

  hide(): void {
    this.loadingSubject.next(false);
  }

  // Convenience methods for different operations
  showCreatingMR(): void {
    this.show('Creating Merge Requests...', 'spinner');
  }

  showSavingSettings(): void {
    this.show('Saving Settings...', 'dots');
  }

  // type: 'spinner' | 'dots' | 'pulse' = 'dots'
  showLoading(message: string = 'Loading...'): void {
    const type = 'spinner';
    this.show(message, type);
  }
}