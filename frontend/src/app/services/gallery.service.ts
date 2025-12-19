import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface GalleryImage {
  _id: string;
  title: string;
  description?: string;
  fileName: string;
  publicUrl: string;
  thumbnailUrl?: string;
  fileSize: number;
  mimeType: string;
  width?: number;
  height?: number;
  uploadedBy: string;
  uploader?: {
    _id: string;
    fullName: string;
    username: string;
  };
  isVisible: boolean;
  viewCount: number;
  tags?: string[];
  eventDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface GalleryResponse {
  success: boolean;
  data: GalleryImage[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    limit: number;
  };
}

export interface SingleImageResponse {
  success: boolean;
  data: GalleryImage;
}

export interface MultipleImageResponse {
  success: boolean;
  message: string;
  data: GalleryImage[];
  uploadedCount: number;
  totalCount: number;
  errors?: { fileName: string; error: string }[];
}

export interface DeleteImageResponse {
  success: boolean;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class GalleryService {
  private apiUrl = `${environment.apiUrl}/gallery`;

  constructor(private http: HttpClient) {}

  /**
   * Get paginated gallery images
   * @param page - Page number (default: 1)
   * @param limit - Items per page (default: 20)
   * @param tags - Optional tags to filter by
   * @param search - Optional search query
   * @returns Observable of gallery response
   */
  getImages(
    page: number = 1,
    limit: number = 20,
    tags?: string[],
    search?: string
  ): Observable<GalleryResponse> {
    let params = new HttpParams().set('page', page.toString()).set('limit', limit.toString());

    if (tags && tags.length > 0) {
      params = params.set('tags', tags.join(','));
    }

    if (search) {
      params = params.set('search', search);
    }

    return this.http.get<GalleryResponse>(this.apiUrl, { params });
  }

  /**
   * Get a single image by ID
   * @param id - Image ID
   * @returns Observable of single image response
   */
  getImage(id: string): Observable<SingleImageResponse> {
    return this.http.get<SingleImageResponse>(`${this.apiUrl}/${id}`);
  }

  /**
   * Upload images (single or multiple, superadmin only)
   * @param formData - FormData containing image(s) and metadata
   * @returns Observable of multiple image response
   */
  uploadImage(formData: FormData): Observable<MultipleImageResponse> {
    return this.http.post<MultipleImageResponse>(this.apiUrl, formData);
  }

  /**
   * Update image metadata (superadmin only)
   * @param id - Image ID
   * @param data - Partial image data to update
   * @returns Observable of single image response
   */
  updateImage(id: string, data: Partial<GalleryImage>): Observable<SingleImageResponse> {
    return this.http.patch<SingleImageResponse>(`${this.apiUrl}/${id}`, data);
  }

  /**
   * Delete an image (superadmin only)
   * @param id - Image ID
   * @returns Observable of delete response
   */
  deleteImage(id: string): Observable<DeleteImageResponse> {
    return this.http.delete<DeleteImageResponse>(`${this.apiUrl}/${id}`);
  }
}
