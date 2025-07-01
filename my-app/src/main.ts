import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { Router } from '@angular/router';
declare const window: any;

bootstrapApplication(App, appConfig).then(ref => {
  const injector = ref.injector;
  const router = injector.get(Router);

  window.electronAPI.getToken().then(({ token }: { token: string }) => {
    if (token) {
      router.navigateByUrl('/home');
    } else {
      router.navigateByUrl('/login');
    }
  });
});
