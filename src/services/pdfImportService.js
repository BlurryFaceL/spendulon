import { API_CONFIG } from '../config/api-config';

class PdfImportService {
  constructor() {
    this.baseUrl = API_CONFIG.baseUrl;
  }

  /**
   * Upload PDF to S3 and trigger processing
   */
  async uploadAndProcessPdf(file, userId, walletId, authToken, password = null, onProgress) {
    try {
      // Step 1: Get presigned URL for S3 upload
      const uploadUrlResponse = await this.getUploadUrl(userId, walletId, file.name, authToken);
      
      // Step 2: Upload file directly to S3
      await this.uploadToS3(uploadUrlResponse.uploadUrl, file, onProgress);
      
      // Step 3: Trigger PDF processing via Lambda
      const result = await this.triggerProcessing(userId, walletId, uploadUrlResponse.s3Key, uploadUrlResponse.s3Bucket, authToken, password);
      
      return {
        ...result,
        s3Key: uploadUrlResponse.s3Key,
        processingId: uploadUrlResponse.processingId
      };
    } catch (error) {
      console.error('PDF upload error:', error);
      throw error;
    }
  }

  /**
   * Convert file to base64 string
   */
  async fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // Remove the data:application/pdf;base64, prefix
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Check processing status and get results
   */
  async getProcessingStatus(userId, walletId, filename, authToken) {
    try {
      const response = await fetch(
        `${this.baseUrl}/pdf/status?userId=${userId}&walletId=${walletId}&filename=${filename}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Status check failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Status check error:', error);
      throw error;
    }
  }

  /**
   * Get categorized transactions directly from S3 (no Lambda needed)
   */
  async getCategorizedTransactions(s3Key, authToken) {
    try {
      // Import AWS SDK dynamically to avoid bundling issues
      const AWS = await import('aws-sdk');
      
      // Configure AWS SDK with user credentials
      AWS.config.update({
        region: 'eu-west-2',
        accessKeyId: process.env.REACT_APP_AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.REACT_APP_AWS_SECRET_ACCESS_KEY,
      });

      const s3 = new AWS.S3();
      
      const response = await s3.getObject({
        Bucket: 'spendulon-ml-processing',
        Key: s3Key
      }).promise();

      const data = JSON.parse(response.Body.toString());
      return data;
    } catch (error) {
      console.error('S3 get results error:', error);
      throw error;
    }
  }

  /**
   * Store ML feedback for training
   */
  async storeMlFeedback(originalResult, userCorrection, authToken, walletId = null) {
    try {
      const response = await fetch(`${this.baseUrl}/ml/feedback`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          originalResult,
          userCorrection,
          walletId,
          source: 'pdf_import',
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to store feedback: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Store feedback error:', error);
      throw error;
    }
  }


  /**
   * Create presigned URL for direct S3 upload (alternative approach)
   */
  async getUploadUrl(userId, walletId, filename, authToken) {
    try {
      const response = await fetch(`${this.baseUrl}/pdf/upload-url`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          walletId,
          filename
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to get upload URL: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get upload URL error:', error);
      throw error;
    }
  }

  /**
   * Upload file directly to S3 using presigned URL
   */
  async uploadToS3(presignedUrl, file, onProgress) {
    try {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable && onProgress) {
            const percentComplete = (event.loaded / event.total) * 100;
            onProgress(percentComplete);
          }
        };

        xhr.onload = () => {
          if (xhr.status === 200) {
            resolve({ success: true });
          } else {
            reject(new Error(`S3 upload failed: ${xhr.status}`));
          }
        };

        xhr.onerror = () => {
          reject(new Error('S3 upload failed'));
        };

        xhr.open('PUT', presignedUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });
    } catch (error) {
      console.error('S3 upload error:', error);
      throw error;
    }
  }

  /**
   * Trigger Lambda processing after S3 upload
   */
  async triggerProcessing(userId, walletId, s3Key, s3Bucket, authToken, password = null) {
    try {
      const response = await fetch(`${this.baseUrl}/pdf/parse`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          s3_bucket: s3Bucket,
          s3_key: s3Key,
          userId: userId,
          walletId: walletId,
          categorize: true,
          password: password || null
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to trigger processing: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Trigger processing error:', error);
      throw error;
    }
  }
}

export default new PdfImportService();