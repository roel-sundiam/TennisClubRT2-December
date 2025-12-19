import { Component, Inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { GalleryImage } from '../../services/gallery.service';

export interface LightboxData {
  images: GalleryImage[];
  currentIndex: number;
}

@Component({
  selector: 'app-image-lightbox',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './image-lightbox.component.html',
  styleUrl: './image-lightbox.component.scss'
})
export class ImageLightboxComponent {
  currentIndex: number;
  images: GalleryImage[];
  touchStartX = 0;
  touchEndX = 0;

  constructor(
    public dialogRef: MatDialogRef<ImageLightboxComponent>,
    @Inject(MAT_DIALOG_DATA) public data: LightboxData
  ) {
    this.images = data.images;
    this.currentIndex = data.currentIndex;
  }

  get currentImage(): GalleryImage {
    return this.images[this.currentIndex];
  }

  get hasPrevious(): boolean {
    return this.currentIndex > 0;
  }

  get hasNext(): boolean {
    return this.currentIndex < this.images.length - 1;
  }

  previous(): void {
    if (this.hasPrevious) {
      this.currentIndex--;
    }
  }

  next(): void {
    if (this.hasNext) {
      this.currentIndex++;
    }
  }

  close(): void {
    this.dialogRef.close();
  }

  // Keyboard navigation
  @HostListener('window:keydown', ['$event'])
  handleKeyboard(event: KeyboardEvent): void {
    if (event.key === 'ArrowLeft') {
      this.previous();
    } else if (event.key === 'ArrowRight') {
      this.next();
    } else if (event.key === 'Escape') {
      this.close();
    }
  }

  // Touch gestures
  onTouchStart(event: TouchEvent): void {
    this.touchStartX = event.changedTouches[0].screenX;
  }

  onTouchEnd(event: TouchEvent): void {
    this.touchEndX = event.changedTouches[0].screenX;
    this.handleSwipe();
  }

  handleSwipe(): void {
    const swipeThreshold = 50;
    const diff = this.touchStartX - this.touchEndX;

    if (Math.abs(diff) > swipeThreshold) {
      if (diff > 0) {
        // Swipe left - next image
        this.next();
      } else {
        // Swipe right - previous image
        this.previous();
      }
    }
  }
}
