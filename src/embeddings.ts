import { Embeddings } from "@langchain/core/embeddings";
import { pipeline, env } from '@xenova/transformers';

// Disable local model loading warning
env.allowLocalModels = false;

export class TransformersEmbeddings extends Embeddings {
  private model: any;
  private initialized: boolean = false;

  constructor() {
    super({});
  }

  private async initModel() {
    if (!this.initialized) {
      this.model = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
        quantized: false
      });
      this.initialized = true;
    }
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    await this.initModel();
    const output = await this.model(text, {
      pooling: 'mean',
      normalize: true
    });
    return Array.from(output.data) as number[];
  }

  async embedQuery(text: string): Promise<number[]> {
    return this.generateEmbedding(text);
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];
    for (const text of texts) {
      const embedding = await this.generateEmbedding(text);
      embeddings.push(embedding);
    }
    return embeddings;
  }
}

// For storing pre-computed embeddings
export class CustomEmbeddings extends Embeddings {
  private vectors: number[][] = [];
  private queryVector: number[] | null = null;

  constructor(vectors: number[][], queryVector?: number[]) {
    super({});
    this.vectors = vectors;
    this.queryVector = queryVector || null;
  }

  async embedQuery(_text: string): Promise<number[]> {
    if (!this.queryVector) {
      throw new Error("No query vector provided");
    }
    return this.queryVector;
  }

  async embedDocuments(_texts: string[]): Promise<number[][]> {
    return this.vectors;
  }
}
