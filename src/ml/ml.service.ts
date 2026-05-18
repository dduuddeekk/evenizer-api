import { Injectable, OnModuleInit } from '@nestjs/common';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-tflite';
import * as path from 'path';

@Injectable()
export class MlService implements OnModuleInit {
  private model: any;
  private modelLoaded = false;

  async onModuleInit() {
    await this.loadModel();
  }

  private async loadModel() {
    try {
      const modelPath = path.join(process.cwd(), 'models', 'organizer_matchmaking_model.tflite');
      this.model = await tf.loadGraphModel(`file://${modelPath}`);
      this.modelLoaded = true;
      console.log('✓ ML model loaded successfully');
    } catch (error: any) {
      console.error('✗ Failed to load ML model:', error?.message);
      this.modelLoaded = false;
    }
  }

  /**
   * Predict match score between event description and organizer description.
   * Returns a score between 0 and 1.
   * @param eventDescription Event description text
   * @param organizerDescription Organizer description/portfolio text
   * @returns Match score (0-1), or null if model not available
   */
  async predictMatch(eventDescription: string, organizerDescription: string): Promise<number | null> {
    if (!this.modelLoaded || !this.model) {
      return null;
    }

    try {
      // Preprocess text: simple tokenization and padding
      const eventTokens = this.tokenize(eventDescription);
      const organizerTokens = this.tokenize(organizerDescription);

      // Create input tensors - assume model expects fixed-size input
      // Adjust padding size based on your model's input shape
      const maxLength = 128;
      const eventInput = this.padTokens(eventTokens, maxLength);
      const organizerInput = this.padTokens(organizerTokens, maxLength);

      // Convert to tensor
      const eventTensor = tf.tensor([eventInput], [1, maxLength], 'int32');
      const organizerTensor = tf.tensor([organizerInput], [1, maxLength], 'int32');

      // Run prediction
      const prediction = this.model.predict([eventTensor, organizerTensor]);
      const score = await prediction.data();

      // Clean up tensors
      eventTensor.dispose();
      organizerTensor.dispose();
      prediction.dispose();

      // Return first value as match score (assuming model outputs single float)
      return Math.min(Math.max(parseFloat(score[0].toString()), 0), 1);
    } catch (error: any) {
      console.error('Error during model inference:', error?.message);
      return null;
    }
  }

  /**
   * Simple tokenizer: convert text to token IDs.
   * In production, use proper tokenizer matching your model's training tokenizer.
   */
  private tokenize(text: string): number[] {
    const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    // Simple hash-based tokenization for demo
    return words.map(word => this.hashWord(word));
  }

  /**
   * Simple hash function for words.
   * In production, use actual vocabulary mapping.
   */
  private hashWord(word: string): number {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      const char = word.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) % 10000; // Keep within reasonable range
  }

  /**
   * Pad token array to fixed length.
   */
  private padTokens(tokens: number[], maxLength: number): number[] {
    if (tokens.length >= maxLength) {
      return tokens.slice(0, maxLength);
    }
    return [...tokens, ...Array(maxLength - tokens.length).fill(0)];
  }

  isModelReady(): boolean {
    return this.modelLoaded && !!this.model;
  }
}
