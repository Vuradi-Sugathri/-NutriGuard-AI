import { NutritionData } from "./types";

interface TFIDFCache {
  vocabulary: Map<string, number>;
  idf: Float64Array;
  tfidfMatrix: Float64Array[];
  dishNames: string[];
}

let cache: TFIDFCache | null = null;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(t => t.length > 0);
}

function buildVocabulary(documents: string[][]): Map<string, number> {
  const vocab = new Map<string, number>();
  let idx = 0;
  for (const doc of documents) {
    for (const token of doc) {
      if (!vocab.has(token)) {
        vocab.set(token, idx++);
      }
    }
  }
  return vocab;
}

function computeTF(tokens: string[], vocab: Map<string, number>): Float64Array {
  const tf = new Float64Array(vocab.size);
  for (const token of tokens) {
    const idx = vocab.get(token);
    if (idx !== undefined) tf[idx]++;
  }
  // Normalize
  const max = Math.max(...tf, 1);
  for (let i = 0; i < tf.length; i++) {
    tf[i] = tf[i] / max;
  }
  return tf;
}

function computeIDF(documents: string[][], vocab: Map<string, number>): Float64Array {
  const n = documents.length;
  const idf = new Float64Array(vocab.size);
  
  for (const doc of documents) {
    const seen = new Set<number>();
    for (const token of doc) {
      const idx = vocab.get(token);
      if (idx !== undefined && !seen.has(idx)) {
        idf[idx]++;
        seen.add(idx);
      }
    }
  }
  
  for (let i = 0; i < idf.length; i++) {
    idf[i] = Math.log((n + 1) / (idf[i] + 1)) + 1;
  }
  
  return idf;
}

function computeTFIDF(tf: Float64Array, idf: Float64Array): Float64Array {
  const tfidf = new Float64Array(tf.length);
  for (let i = 0; i < tf.length; i++) {
    tfidf[i] = tf[i] * idf[i];
  }
  return tfidf;
}

function cosineSimilarity(a: Float64Array, b: Float64Array): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

export function buildTFIDFIndex(dataset: NutritionData[]): void {
  const dishNames = dataset.map(d => d.dishName);
  const tokenizedDocs = dishNames.map(name => tokenize(name));
  const vocabulary = buildVocabulary(tokenizedDocs);
  const idf = computeIDF(tokenizedDocs, vocabulary);
  
  const tfidfMatrix: Float64Array[] = tokenizedDocs.map(tokens => {
    const tf = computeTF(tokens, vocabulary);
    return computeTFIDF(tf, idf);
  });
  
  cache = { vocabulary, idf, tfidfMatrix, dishNames };
}

export interface MatchResult {
  dishName: string;
  index: number;
  similarity: number;
}

export function findBestMatch(query: string, dataset: NutritionData[]): MatchResult {
  if (!cache) buildTFIDFIndex(dataset);
  
  const queryTokens = tokenize(query);
  const tf = computeTF(queryTokens, cache!.vocabulary);
  const queryTFIDF = computeTFIDF(tf, cache!.idf);
  
  let bestIdx = 0;
  let bestSim = -1;
  
  for (let i = 0; i < cache!.tfidfMatrix.length; i++) {
    const sim = cosineSimilarity(queryTFIDF, cache!.tfidfMatrix[i]);
    if (sim > bestSim) {
      bestSim = sim;
      bestIdx = i;
    }
  }
  
  return {
    dishName: cache!.dishNames[bestIdx],
    index: bestIdx,
    similarity: +(bestSim * 100).toFixed(1),
  };
}
