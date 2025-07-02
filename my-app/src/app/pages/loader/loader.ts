import { NgClass, NgIf } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-loader',
  imports: [NgClass, NgIf],
  templateUrl: './loader.html',
  styleUrl: './loader.scss'
})
export class Loader {
  @Input() show: boolean | null = false;
  @Input() message: string | null = 'Loading...';
  @Input() loaderType: 'spinner' | 'dots' | 'pulse' | null = 'spinner';
}
