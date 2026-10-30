// Automatisch erzeugt von scripts/update-catalog.mjs – nicht von Hand bearbeiten.
// Stand: 2026-10-30. GGUF-Quantisierungen von unsloth, ggml-org und bartowski;
// es gilt jeweils die Lizenz des Originalmodells.
import type { CatalogModel } from '../shared/types'

export const CATALOG: CatalogModel[] = [
  {
    "id": "qwen3.5-0.8b",
    "name": "Qwen3.5 0.8B",
    "description": "Winzig und blitzschnell. Für einfache Fragen und Autovervollständigung.",
    "repo": "unsloth/Qwen3.5-0.8B-GGUF",
    "sizeClass": "klein",
    "totalParamsB": 0.8,
    "activeParamsB": 0.8,
    "tags": [
      "Allround",
      "winzig"
    ],
    "license": {
      "name": "Apache 2.0",
      "url": "https://huggingface.co/Qwen/Qwen3.5-0.8B/blob/main/LICENSE",
      "commercial": true
    },
    "recommendedVariant": "qwen3.5-0.8b:Q4_K_M",
    "variants": [
      {
        "id": "qwen3.5-0.8b:Q4_K_M",
        "quant": "Q4_K_M",
        "label": "4-Bit – empfohlen: schnell, kaum Qualitätsverlust",
        "sizeBytes": 532517120,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-0.8B-GGUF/resolve/main/Qwen3.5-0.8B-Q4_K_M.gguf",
            "fileName": "Qwen3.5-0.8B-Q4_K_M.gguf",
            "sizeBytes": 532517120
          }
        ]
      },
      {
        "id": "qwen3.5-0.8b:Q6_K",
        "quant": "Q6_K",
        "label": "6-Bit – sehr gute Qualität",
        "sizeBytes": 639029504,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-0.8B-GGUF/resolve/main/Qwen3.5-0.8B-Q6_K.gguf",
            "fileName": "Qwen3.5-0.8B-Q6_K.gguf",
            "sizeBytes": 639029504
          }
        ]
      },
      {
        "id": "qwen3.5-0.8b:Q8_0",
        "quant": "Q8_0",
        "label": "8-Bit – nahezu verlustfrei",
        "sizeBytes": 811843840,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-0.8B-GGUF/resolve/main/Qwen3.5-0.8B-Q8_0.gguf",
            "fileName": "Qwen3.5-0.8B-Q8_0.gguf",
            "sizeBytes": 811843840
          }
        ]
      },
      {
        "id": "qwen3.5-0.8b:BF16",
        "quant": "BF16",
        "label": "16-Bit – Original, unquantisiert (groß und langsamer)",
        "sizeBytes": 1516744736,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-0.8B-GGUF/resolve/main/Qwen3.5-0.8B-BF16.gguf",
            "fileName": "Qwen3.5-0.8B-BF16.gguf",
            "sizeBytes": 1516744736
          }
        ]
      }
    ]
  },
  {
    "id": "qwen2.5-coder-1.5b",
    "name": "Qwen2.5 Coder 1.5B",
    "description": "Sehr schnell, gut für kurze Code-Fragen. Etwas älter.",
    "repo": "bartowski/Qwen2.5-Coder-1.5B-Instruct-GGUF",
    "sizeClass": "klein",
    "totalParamsB": 1.5,
    "activeParamsB": 1.5,
    "tags": [
      "Code"
    ],
    "license": {
      "name": "Apache 2.0",
      "url": "https://huggingface.co/Qwen/Qwen2.5-Coder-1.5B-Instruct/blob/main/LICENSE",
      "commercial": true
    },
    "recommendedVariant": "qwen2.5-coder-1.5b:Q4_K_M",
    "variants": [
      {
        "id": "qwen2.5-coder-1.5b:Q4_K_M",
        "quant": "Q4_K_M",
        "label": "4-Bit – empfohlen: schnell, kaum Qualitätsverlust",
        "sizeBytes": 986048800,
        "files": [
          {
            "url": "https://huggingface.co/bartowski/Qwen2.5-Coder-1.5B-Instruct-GGUF/resolve/main/Qwen2.5-Coder-1.5B-Instruct-Q4_K_M.gguf",
            "fileName": "Qwen2.5-Coder-1.5B-Instruct-Q4_K_M.gguf",
            "sizeBytes": 986048800
          }
        ]
      },
      {
        "id": "qwen2.5-coder-1.5b:Q6_K",
        "quant": "Q6_K",
        "label": "6-Bit – sehr gute Qualität",
        "sizeBytes": 1272740128,
        "files": [
          {
            "url": "https://huggingface.co/bartowski/Qwen2.5-Coder-1.5B-Instruct-GGUF/resolve/main/Qwen2.5-Coder-1.5B-Instruct-Q6_K.gguf",
            "fileName": "Qwen2.5-Coder-1.5B-Instruct-Q6_K.gguf",
            "sizeBytes": 1272740128
          }
        ]
      },
      {
        "id": "qwen2.5-coder-1.5b:Q8_0",
        "quant": "Q8_0",
        "label": "8-Bit – nahezu verlustfrei",
        "sizeBytes": 1646573344,
        "files": [
          {
            "url": "https://huggingface.co/bartowski/Qwen2.5-Coder-1.5B-Instruct-GGUF/resolve/main/Qwen2.5-Coder-1.5B-Instruct-Q8_0.gguf",
            "fileName": "Qwen2.5-Coder-1.5B-Instruct-Q8_0.gguf",
            "sizeBytes": 1646573344
          }
        ]
      },
      {
        "id": "qwen2.5-coder-1.5b:f16",
        "quant": "F16",
        "label": "16-Bit – Original, unquantisiert (groß und langsamer)",
        "sizeBytes": 3093669376,
        "files": [
          {
            "url": "https://huggingface.co/bartowski/Qwen2.5-Coder-1.5B-Instruct-GGUF/resolve/main/Qwen2.5-Coder-1.5B-Instruct-f16.gguf",
            "fileName": "Qwen2.5-Coder-1.5B-Instruct-f16.gguf",
            "sizeBytes": 3093669376
          }
        ]
      }
    ]
  },
  {
    "id": "qwen3.5-2b",
    "name": "Qwen3.5 2B",
    "description": "Klein und schnell, überraschend brauchbar für Code und Deutsch.",
    "repo": "unsloth/Qwen3.5-2B-GGUF",
    "sizeClass": "klein",
    "totalParamsB": 1.9,
    "activeParamsB": 1.9,
    "tags": [
      "Allround",
      "schnell"
    ],
    "license": {
      "name": "Apache 2.0",
      "url": "https://huggingface.co/Qwen/Qwen3.5-2B/blob/main/LICENSE",
      "commercial": true
    },
    "recommendedVariant": "qwen3.5-2b:Q4_K_M",
    "variants": [
      {
        "id": "qwen3.5-2b:Q4_K_M",
        "quant": "Q4_K_M",
        "label": "4-Bit – empfohlen: schnell, kaum Qualitätsverlust",
        "sizeBytes": 1280835840,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-2B-GGUF/resolve/main/Qwen3.5-2B-Q4_K_M.gguf",
            "fileName": "Qwen3.5-2B-Q4_K_M.gguf",
            "sizeBytes": 1280835840
          }
        ]
      },
      {
        "id": "qwen3.5-2b:Q6_K",
        "quant": "Q6_K",
        "label": "6-Bit – sehr gute Qualität",
        "sizeBytes": 1574961408,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-2B-GGUF/resolve/main/Qwen3.5-2B-Q6_K.gguf",
            "fileName": "Qwen3.5-2B-Q6_K.gguf",
            "sizeBytes": 1574961408
          }
        ]
      },
      {
        "id": "qwen3.5-2b:Q8_0",
        "quant": "Q8_0",
        "label": "8-Bit – nahezu verlustfrei",
        "sizeBytes": 2012012800,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-2B-GGUF/resolve/main/Qwen3.5-2B-Q8_0.gguf",
            "fileName": "Qwen3.5-2B-Q8_0.gguf",
            "sizeBytes": 2012012800
          }
        ]
      },
      {
        "id": "qwen3.5-2b:BF16",
        "quant": "BF16",
        "label": "16-Bit – Original, unquantisiert (groß und langsamer)",
        "sizeBytes": 3775709216,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-2B-GGUF/resolve/main/Qwen3.5-2B-BF16.gguf",
            "fileName": "Qwen3.5-2B-BF16.gguf",
            "sizeBytes": 3775709216
          }
        ]
      }
    ]
  },
  {
    "id": "gemma-4-e2b",
    "name": "Gemma 4 E2B",
    "description": "Googles kleinstes Gemma 4, für Laptops und Handys optimiert.",
    "repo": "unsloth/gemma-4-E2B-it-GGUF",
    "sizeClass": "klein",
    "totalParamsB": 4.6,
    "activeParamsB": 2,
    "tags": [
      "Allround",
      "Deutsch"
    ],
    "license": {
      "name": "Apache 2.0",
      "url": "https://huggingface.co/google/gemma-4-E2B-it/blob/main/LICENSE",
      "commercial": true
    },
    "recommendedVariant": "gemma-4-e2b:Q4_K_M",
    "variants": [
      {
        "id": "gemma-4-e2b:Q4_K_M",
        "quant": "Q4_K_M",
        "label": "4-Bit – empfohlen: schnell, kaum Qualitätsverlust",
        "sizeBytes": 3106738272,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF/resolve/main/gemma-4-E2B-it-Q4_K_M.gguf",
            "fileName": "gemma-4-E2B-it-Q4_K_M.gguf",
            "sizeBytes": 3106738272
          }
        ]
      },
      {
        "id": "gemma-4-e2b:Q6_K",
        "quant": "Q6_K",
        "label": "6-Bit – sehr gute Qualität",
        "sizeBytes": 4501721184,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF/resolve/main/gemma-4-E2B-it-Q6_K.gguf",
            "fileName": "gemma-4-E2B-it-Q6_K.gguf",
            "sizeBytes": 4501721184
          }
        ]
      },
      {
        "id": "gemma-4-e2b:Q8_0",
        "quant": "Q8_0",
        "label": "8-Bit – nahezu verlustfrei",
        "sizeBytes": 5048352864,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF/resolve/main/gemma-4-E2B-it-Q8_0.gguf",
            "fileName": "gemma-4-E2B-it-Q8_0.gguf",
            "sizeBytes": 5048352864
          }
        ]
      },
      {
        "id": "gemma-4-e2b:BF16",
        "quant": "BF16",
        "label": "16-Bit – Original, unquantisiert (groß und langsamer)",
        "sizeBytes": 9311305568,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF/resolve/main/gemma-4-E2B-it-BF16.gguf",
            "fileName": "gemma-4-E2B-it-BF16.gguf",
            "sizeBytes": 9311305568
          }
        ]
      }
    ]
  },
  {
    "id": "qwen2.5-coder-3b",
    "name": "Qwen2.5 Coder 3B",
    "description": "Solides Code-Modell, aber älter und nur nicht-kommerziell nutzbar.",
    "repo": "bartowski/Qwen2.5-Coder-3B-Instruct-GGUF",
    "sizeClass": "klein",
    "totalParamsB": 3.1,
    "activeParamsB": 3.1,
    "tags": [
      "Code"
    ],
    "license": {
      "name": "Qwen Research License",
      "url": "https://huggingface.co/Qwen/Qwen2.5-Coder-3B-Instruct/blob/main/LICENSE",
      "commercial": false,
      "note": "Nur für nicht-kommerzielle Zwecke (Forschung/Ausprobieren). Für kommerzielle Nutzung braucht es eine Lizenz von Alibaba."
    },
    "recommendedVariant": "qwen2.5-coder-3b:Q4_K_M",
    "variants": [
      {
        "id": "qwen2.5-coder-3b:Q4_K_M",
        "quant": "Q4_K_M",
        "label": "4-Bit – empfohlen: schnell, kaum Qualitätsverlust",
        "sizeBytes": 1929903360,
        "files": [
          {
            "url": "https://huggingface.co/bartowski/Qwen2.5-Coder-3B-Instruct-GGUF/resolve/main/Qwen2.5-Coder-3B-Instruct-Q4_K_M.gguf",
            "fileName": "Qwen2.5-Coder-3B-Instruct-Q4_K_M.gguf",
            "sizeBytes": 1929903360
          }
        ]
      },
      {
        "id": "qwen2.5-coder-3b:Q6_K",
        "quant": "Q6_K",
        "label": "6-Bit – sehr gute Qualität",
        "sizeBytes": 2538159360,
        "files": [
          {
            "url": "https://huggingface.co/bartowski/Qwen2.5-Coder-3B-Instruct-GGUF/resolve/main/Qwen2.5-Coder-3B-Instruct-Q6_K.gguf",
            "fileName": "Qwen2.5-Coder-3B-Instruct-Q6_K.gguf",
            "sizeBytes": 2538159360
          }
        ]
      },
      {
        "id": "qwen2.5-coder-3b:Q8_0",
        "quant": "Q8_0",
        "label": "8-Bit – nahezu verlustfrei",
        "sizeBytes": 3285476608,
        "files": [
          {
            "url": "https://huggingface.co/bartowski/Qwen2.5-Coder-3B-Instruct-GGUF/resolve/main/Qwen2.5-Coder-3B-Instruct-Q8_0.gguf",
            "fileName": "Qwen2.5-Coder-3B-Instruct-Q8_0.gguf",
            "sizeBytes": 3285476608
          }
        ]
      },
      {
        "id": "qwen2.5-coder-3b:f16",
        "quant": "F16",
        "label": "16-Bit – Original, unquantisiert (groß und langsamer)",
        "sizeBytes": 6178317280,
        "files": [
          {
            "url": "https://huggingface.co/bartowski/Qwen2.5-Coder-3B-Instruct-GGUF/resolve/main/Qwen2.5-Coder-3B-Instruct-f16.gguf",
            "fileName": "Qwen2.5-Coder-3B-Instruct-f16.gguf",
            "sizeBytes": 6178317280
          }
        ]
      }
    ]
  },
  {
    "id": "qwen3.5-4b",
    "name": "Qwen3.5 4B",
    "description": "Bester Allrounder für 8 GB RAM: gut bei Code, Werkzeugen und Deutsch.",
    "repo": "unsloth/Qwen3.5-4B-GGUF",
    "sizeClass": "klein",
    "totalParamsB": 4.2,
    "activeParamsB": 4.2,
    "tags": [
      "Allround",
      "Code",
      "empfohlen"
    ],
    "license": {
      "name": "Apache 2.0",
      "url": "https://huggingface.co/Qwen/Qwen3.5-4B/blob/main/LICENSE",
      "commercial": true
    },
    "recommendedVariant": "qwen3.5-4b:Q4_K_M",
    "variants": [
      {
        "id": "qwen3.5-4b:Q4_K_M",
        "quant": "Q4_K_M",
        "label": "4-Bit – empfohlen: schnell, kaum Qualitätsverlust",
        "sizeBytes": 2740937888,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-4B-GGUF/resolve/main/Qwen3.5-4B-Q4_K_M.gguf",
            "fileName": "Qwen3.5-4B-Q4_K_M.gguf",
            "sizeBytes": 2740937888
          }
        ]
      },
      {
        "id": "qwen3.5-4b:Q6_K",
        "quant": "Q6_K",
        "label": "6-Bit – sehr gute Qualität",
        "sizeBytes": 3525956768,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-4B-GGUF/resolve/main/Qwen3.5-4B-Q6_K.gguf",
            "fileName": "Qwen3.5-4B-Q6_K.gguf",
            "sizeBytes": 3525956768
          }
        ]
      },
      {
        "id": "qwen3.5-4b:Q8_0",
        "quant": "Q8_0",
        "label": "8-Bit – nahezu verlustfrei",
        "sizeBytes": 4482403488,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-4B-GGUF/resolve/main/Qwen3.5-4B-Q8_0.gguf",
            "fileName": "Qwen3.5-4B-Q8_0.gguf",
            "sizeBytes": 4482403488
          }
        ]
      },
      {
        "id": "qwen3.5-4b:BF16",
        "quant": "BF16",
        "label": "16-Bit – Original, unquantisiert (groß und langsamer)",
        "sizeBytes": 8424393632,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-4B-GGUF/resolve/main/Qwen3.5-4B-BF16.gguf",
            "fileName": "Qwen3.5-4B-BF16.gguf",
            "sizeBytes": 8424393632
          }
        ]
      }
    ]
  },
  {
    "id": "gemma-4-e4b",
    "name": "Gemma 4 E4B",
    "description": "Gemma 4 für Laptops: stark beim Formulieren und in Deutsch.",
    "repo": "unsloth/gemma-4-E4B-it-GGUF",
    "sizeClass": "klein",
    "totalParamsB": 7.5,
    "activeParamsB": 4,
    "tags": [
      "Allround",
      "Deutsch"
    ],
    "license": {
      "name": "Apache 2.0",
      "url": "https://huggingface.co/google/gemma-4-E4B-it/blob/main/LICENSE",
      "commercial": true
    },
    "recommendedVariant": "gemma-4-e4b:Q4_K_M",
    "variants": [
      {
        "id": "gemma-4-e4b:Q4_K_M",
        "quant": "Q4_K_M",
        "label": "4-Bit – empfohlen: schnell, kaum Qualitätsverlust",
        "sizeBytes": 4977171584,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/gemma-4-E4B-it-GGUF/resolve/main/gemma-4-E4B-it-Q4_K_M.gguf",
            "fileName": "gemma-4-E4B-it-Q4_K_M.gguf",
            "sizeBytes": 4977171584
          }
        ]
      },
      {
        "id": "gemma-4-e4b:Q6_K",
        "quant": "Q6_K",
        "label": "6-Bit – sehr gute Qualität",
        "sizeBytes": 7074929792,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/gemma-4-E4B-it-GGUF/resolve/main/gemma-4-E4B-it-Q6_K.gguf",
            "fileName": "gemma-4-E4B-it-Q6_K.gguf",
            "sizeBytes": 7074929792
          }
        ]
      },
      {
        "id": "gemma-4-e4b:Q8_0",
        "quant": "Q8_0",
        "label": "8-Bit – nahezu verlustfrei",
        "sizeBytes": 8192953472,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/gemma-4-E4B-it-GGUF/resolve/main/gemma-4-E4B-it-Q8_0.gguf",
            "fileName": "gemma-4-E4B-it-Q8_0.gguf",
            "sizeBytes": 8192953472
          }
        ]
      },
      {
        "id": "gemma-4-e4b:BF16",
        "quant": "BF16",
        "label": "16-Bit – Original, unquantisiert (groß und langsamer)",
        "sizeBytes": 15053097856,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/gemma-4-E4B-it-GGUF/resolve/main/gemma-4-E4B-it-BF16.gguf",
            "fileName": "gemma-4-E4B-it-BF16.gguf",
            "sizeBytes": 15053097856
          }
        ]
      }
    ]
  },
  {
    "id": "qwen2.5-coder-7b",
    "name": "Qwen2.5 Coder 7B",
    "description": "Bewährtes Code-Modell, inzwischen von Qwen3.5 überholt.",
    "repo": "bartowski/Qwen2.5-Coder-7B-Instruct-GGUF",
    "sizeClass": "mittel",
    "totalParamsB": 7.6,
    "activeParamsB": 7.6,
    "tags": [
      "Code"
    ],
    "license": {
      "name": "Apache 2.0",
      "url": "https://huggingface.co/Qwen/Qwen2.5-Coder-7B-Instruct/blob/main/LICENSE",
      "commercial": true
    },
    "recommendedVariant": "qwen2.5-coder-7b:Q4_K_M",
    "variants": [
      {
        "id": "qwen2.5-coder-7b:Q4_K_M",
        "quant": "Q4_K_M",
        "label": "4-Bit – empfohlen: schnell, kaum Qualitätsverlust",
        "sizeBytes": 4683074336,
        "files": [
          {
            "url": "https://huggingface.co/bartowski/Qwen2.5-Coder-7B-Instruct-GGUF/resolve/main/Qwen2.5-Coder-7B-Instruct-Q4_K_M.gguf",
            "fileName": "Qwen2.5-Coder-7B-Instruct-Q4_K_M.gguf",
            "sizeBytes": 4683074336
          }
        ]
      },
      {
        "id": "qwen2.5-coder-7b:Q6_K",
        "quant": "Q6_K",
        "label": "6-Bit – sehr gute Qualität",
        "sizeBytes": 6254199584,
        "files": [
          {
            "url": "https://huggingface.co/bartowski/Qwen2.5-Coder-7B-Instruct-GGUF/resolve/main/Qwen2.5-Coder-7B-Instruct-Q6_K.gguf",
            "fileName": "Qwen2.5-Coder-7B-Instruct-Q6_K.gguf",
            "sizeBytes": 6254199584
          }
        ]
      },
      {
        "id": "qwen2.5-coder-7b:Q8_0",
        "quant": "Q8_0",
        "label": "8-Bit – nahezu verlustfrei",
        "sizeBytes": 8098525984,
        "files": [
          {
            "url": "https://huggingface.co/bartowski/Qwen2.5-Coder-7B-Instruct-GGUF/resolve/main/Qwen2.5-Coder-7B-Instruct-Q8_0.gguf",
            "fileName": "Qwen2.5-Coder-7B-Instruct-Q8_0.gguf",
            "sizeBytes": 8098525984
          }
        ]
      },
      {
        "id": "qwen2.5-coder-7b:f16",
        "quant": "F16",
        "label": "16-Bit – Original, unquantisiert (groß und langsamer)",
        "sizeBytes": 15237853696,
        "files": [
          {
            "url": "https://huggingface.co/bartowski/Qwen2.5-Coder-7B-Instruct-GGUF/resolve/main/Qwen2.5-Coder-7B-Instruct-f16.gguf",
            "fileName": "Qwen2.5-Coder-7B-Instruct-f16.gguf",
            "sizeBytes": 15237853696
          }
        ]
      }
    ]
  },
  {
    "id": "qwen3.5-9b",
    "name": "Qwen3.5 9B",
    "description": "Deutlich klüger als die kleinen Modelle, guter Coding-Agent.",
    "repo": "unsloth/Qwen3.5-9B-GGUF",
    "sizeClass": "mittel",
    "totalParamsB": 9,
    "activeParamsB": 9,
    "tags": [
      "Allround",
      "Code"
    ],
    "license": {
      "name": "Apache 2.0",
      "url": "https://huggingface.co/Qwen/Qwen3.5-9B/blob/main/LICENSE",
      "commercial": true
    },
    "recommendedVariant": "qwen3.5-9b:Q4_K_M",
    "variants": [
      {
        "id": "qwen3.5-9b:Q4_K_M",
        "quant": "Q4_K_M",
        "label": "4-Bit – empfohlen: schnell, kaum Qualitätsverlust",
        "sizeBytes": 5680522464,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-9B-GGUF/resolve/main/Qwen3.5-9B-Q4_K_M.gguf",
            "fileName": "Qwen3.5-9B-Q4_K_M.gguf",
            "sizeBytes": 5680522464
          }
        ]
      },
      {
        "id": "qwen3.5-9b:Q6_K",
        "quant": "Q6_K",
        "label": "6-Bit – sehr gute Qualität",
        "sizeBytes": 7458301152,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-9B-GGUF/resolve/main/Qwen3.5-9B-Q6_K.gguf",
            "fileName": "Qwen3.5-9B-Q6_K.gguf",
            "sizeBytes": 7458301152
          }
        ]
      },
      {
        "id": "qwen3.5-9b:Q8_0",
        "quant": "Q8_0",
        "label": "8-Bit – nahezu verlustfrei",
        "sizeBytes": 9527502048,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-9B-GGUF/resolve/main/Qwen3.5-9B-Q8_0.gguf",
            "fileName": "Qwen3.5-9B-Q8_0.gguf",
            "sizeBytes": 9527502048
          }
        ]
      },
      {
        "id": "qwen3.5-9b:BF16",
        "quant": "BF16",
        "label": "16-Bit – Original, unquantisiert (groß und langsamer)",
        "sizeBytes": 17920697312,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-9B-GGUF/resolve/main/Qwen3.5-9B-BF16.gguf",
            "fileName": "Qwen3.5-9B-BF16.gguf",
            "sizeBytes": 17920697312
          }
        ]
      }
    ]
  },
  {
    "id": "gemma-4-12b",
    "name": "Gemma 4 12B",
    "description": "Ausgewogenes Gemma-4-Modell, sehr gut in Deutsch.",
    "repo": "unsloth/gemma-4-12b-it-GGUF",
    "sizeClass": "mittel",
    "totalParamsB": 11.9,
    "activeParamsB": 11.9,
    "tags": [
      "Allround",
      "Deutsch"
    ],
    "license": {
      "name": "Apache 2.0",
      "url": "https://huggingface.co/google/gemma-4-12B-it/blob/main/LICENSE",
      "commercial": true
    },
    "recommendedVariant": "gemma-4-12b:Q4_K_M",
    "variants": [
      {
        "id": "gemma-4-12b:Q3_K_M",
        "quant": "Q3_K_M",
        "label": "3-Bit – klein, leichte Einbußen",
        "sizeBytes": 5693872960,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/gemma-4-12b-it-GGUF/resolve/main/gemma-4-12b-it-Q3_K_M.gguf",
            "fileName": "gemma-4-12b-it-Q3_K_M.gguf",
            "sizeBytes": 5693872960
          }
        ]
      },
      {
        "id": "gemma-4-12b:Q4_K_M",
        "quant": "Q4_K_M",
        "label": "4-Bit – empfohlen: schnell, kaum Qualitätsverlust",
        "sizeBytes": 7121861440,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/gemma-4-12b-it-GGUF/resolve/main/gemma-4-12b-it-Q4_K_M.gguf",
            "fileName": "gemma-4-12b-it-Q4_K_M.gguf",
            "sizeBytes": 7121861440
          }
        ]
      },
      {
        "id": "gemma-4-12b:Q6_K",
        "quant": "Q6_K",
        "label": "6-Bit – sehr gute Qualität",
        "sizeBytes": 9786022720,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/gemma-4-12b-it-GGUF/resolve/main/gemma-4-12b-it-Q6_K.gguf",
            "fileName": "gemma-4-12b-it-Q6_K.gguf",
            "sizeBytes": 9786022720
          }
        ]
      },
      {
        "id": "gemma-4-12b:Q8_0",
        "quant": "Q8_0",
        "label": "8-Bit – nahezu verlustfrei",
        "sizeBytes": 12669647680,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/gemma-4-12b-it-GGUF/resolve/main/gemma-4-12b-it-Q8_0.gguf",
            "fileName": "gemma-4-12b-it-Q8_0.gguf",
            "sizeBytes": 12669647680
          }
        ]
      },
      {
        "id": "gemma-4-12b:BF16",
        "quant": "BF16",
        "label": "16-Bit – Original, unquantisiert (groß und langsamer)",
        "sizeBytes": 23832066656,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/gemma-4-12b-it-GGUF/resolve/main/gemma-4-12b-it-BF16.gguf",
            "fileName": "gemma-4-12b-it-BF16.gguf",
            "sizeBytes": 23832066656
          }
        ]
      }
    ]
  },
  {
    "id": "gpt-oss-20b",
    "name": "gpt-oss 20B",
    "description": "Offenes Modell von OpenAI. MoE: rechnet nur 3,6B pro Wort – sehr schnell, stark bei Logik und Werkzeugen.",
    "repo": "ggml-org/gpt-oss-20b-GGUF",
    "sizeClass": "mittel",
    "totalParamsB": 20.9,
    "activeParamsB": 3.6,
    "tags": [
      "Reasoning",
      "schnell",
      "MoE"
    ],
    "license": {
      "name": "Apache 2.0",
      "url": "https://huggingface.co/openai/gpt-oss-20b/blob/main/LICENSE",
      "commercial": true
    },
    "recommendedVariant": "gpt-oss-20b:MXFP4",
    "variants": [
      {
        "id": "gpt-oss-20b:MXFP4",
        "quant": "MXFP4",
        "label": "MXFP4 – Originalformat, so wurde das Modell trainiert",
        "sizeBytes": 12109566624,
        "files": [
          {
            "url": "https://huggingface.co/ggml-org/gpt-oss-20b-GGUF/resolve/main/gpt-oss-20b-MXFP4.gguf",
            "fileName": "gpt-oss-20b-MXFP4.gguf",
            "sizeBytes": 12109566624
          }
        ]
      }
    ]
  },
  {
    "id": "gemma-4-26b-a4b",
    "name": "Gemma 4 26B A4B",
    "description": "MoE-Gemma: Wissen eines großen Modells, Tempo eines kleinen.",
    "repo": "unsloth/gemma-4-26B-A4B-it-GGUF",
    "sizeClass": "mittel",
    "totalParamsB": 25.2,
    "activeParamsB": 4,
    "tags": [
      "Allround",
      "schnell",
      "MoE"
    ],
    "license": {
      "name": "Apache 2.0",
      "url": "https://huggingface.co/google/gemma-4-26B-A4B-it/blob/main/LICENSE",
      "commercial": true
    },
    "recommendedVariant": "gemma-4-26b-a4b:UD-Q4_K_M",
    "variants": [
      {
        "id": "gemma-4-26b-a4b:UD-Q3_K_M",
        "quant": "UD-Q3_K_M",
        "label": "3-Bit (Unsloth Dynamic) – klein, leichte Einbußen",
        "sizeBytes": 12728497888,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/gemma-4-26B-A4B-it-GGUF/resolve/main/gemma-4-26B-A4B-it-UD-Q3_K_M.gguf",
            "fileName": "gemma-4-26B-A4B-it-UD-Q3_K_M.gguf",
            "sizeBytes": 12728497888
          }
        ]
      },
      {
        "id": "gemma-4-26b-a4b:UD-Q4_K_M",
        "quant": "UD-Q4_K_M",
        "label": "4-Bit (Unsloth Dynamic) – empfohlen: schnell, kaum Qualitätsverlust",
        "sizeBytes": 16947541728,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/gemma-4-26B-A4B-it-GGUF/resolve/main/gemma-4-26B-A4B-it-UD-Q4_K_M.gguf",
            "fileName": "gemma-4-26B-A4B-it-UD-Q4_K_M.gguf",
            "sizeBytes": 16947541728
          }
        ]
      },
      {
        "id": "gemma-4-26b-a4b:UD-Q6_K",
        "quant": "UD-Q6_K",
        "label": "6-Bit (Unsloth Dynamic) – sehr gute Qualität",
        "sizeBytes": 23172478688,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/gemma-4-26B-A4B-it-GGUF/resolve/main/gemma-4-26B-A4B-it-UD-Q6_K.gguf",
            "fileName": "gemma-4-26B-A4B-it-UD-Q6_K.gguf",
            "sizeBytes": 23172478688
          }
        ]
      },
      {
        "id": "gemma-4-26b-a4b:Q8_0",
        "quant": "Q8_0",
        "label": "8-Bit – nahezu verlustfrei",
        "sizeBytes": 26859861728,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/gemma-4-26B-A4B-it-GGUF/resolve/main/gemma-4-26B-A4B-it-Q8_0.gguf",
            "fileName": "gemma-4-26B-A4B-it-Q8_0.gguf",
            "sizeBytes": 26859861728
          }
        ]
      },
      {
        "id": "gemma-4-26b-a4b:BF16",
        "quant": "BF16",
        "label": "16-Bit – Original, unquantisiert (groß und langsamer)",
        "sizeBytes": 50505137824,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/gemma-4-26B-A4B-it-GGUF/resolve/main/BF16/gemma-4-26B-A4B-it-BF16-00001-of-00002.gguf",
            "fileName": "gemma-4-26B-A4B-it-BF16-00001-of-00002.gguf",
            "sizeBytes": 49923215552
          },
          {
            "url": "https://huggingface.co/unsloth/gemma-4-26B-A4B-it-GGUF/resolve/main/BF16/gemma-4-26B-A4B-it-BF16-00002-of-00002.gguf",
            "fileName": "gemma-4-26B-A4B-it-BF16-00002-of-00002.gguf",
            "sizeBytes": 581922272
          }
        ]
      }
    ]
  },
  {
    "id": "qwen3.8-27b",
    "name": "Qwen3.8 27B",
    "description": "Aktuell eines der stärksten Modelle dieser Größe. Dicht (kein MoE), daher langsamer.",
    "repo": "unsloth/Qwen3.8-27B-GGUF",
    "sizeClass": "mittel",
    "totalParamsB": 27.3,
    "activeParamsB": 27.3,
    "tags": [
      "Allround",
      "Code",
      "Qualität"
    ],
    "license": {
      "name": "Apache 2.0",
      "url": "https://huggingface.co/Qwen/Qwen3.8-27B/blob/main/LICENSE",
      "commercial": true
    },
    "recommendedVariant": "qwen3.8-27b:UD-Q4_K_M",
    "variants": [
      {
        "id": "qwen3.8-27b:UD-Q3_K_XL",
        "quant": "UD-Q3_K_XL",
        "label": "3-Bit (Unsloth Dynamic) – klein, leichte Einbußen",
        "sizeBytes": 13146393504,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/Qwen3.8-27B-GGUF/resolve/main/Qwen3.8-27B-UD-Q3_K_XL.gguf",
            "fileName": "Qwen3.8-27B-UD-Q3_K_XL.gguf",
            "sizeBytes": 13146393504
          }
        ]
      },
      {
        "id": "qwen3.8-27b:UD-Q4_K_M",
        "quant": "UD-Q4_K_M",
        "label": "4-Bit (Unsloth Dynamic) – empfohlen: schnell, kaum Qualitätsverlust",
        "sizeBytes": 16464440224,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/Qwen3.8-27B-GGUF/resolve/main/Qwen3.8-27B-UD-Q4_K_M.gguf",
            "fileName": "Qwen3.8-27B-UD-Q4_K_M.gguf",
            "sizeBytes": 16464440224
          }
        ]
      },
      {
        "id": "qwen3.8-27b:UD-Q6_K",
        "quant": "UD-Q6_K",
        "label": "6-Bit (Unsloth Dynamic) – sehr gute Qualität",
        "sizeBytes": 21983677344,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/Qwen3.8-27B-GGUF/resolve/main/Qwen3.8-27B-UD-Q6_K.gguf",
            "fileName": "Qwen3.8-27B-UD-Q6_K.gguf",
            "sizeBytes": 21983677344
          }
        ]
      },
      {
        "id": "qwen3.8-27b:Q8_0",
        "quant": "Q8_0",
        "label": "8-Bit – nahezu verlustfrei",
        "sizeBytes": 29047086048,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/Qwen3.8-27B-GGUF/resolve/main/Qwen3.8-27B-Q8_0.gguf",
            "fileName": "Qwen3.8-27B-Q8_0.gguf",
            "sizeBytes": 29047086048
          }
        ]
      },
      {
        "id": "qwen3.8-27b:BF16",
        "quant": "BF16",
        "label": "16-Bit – Original, unquantisiert (groß und langsamer)",
        "sizeBytes": 54657735616,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/Qwen3.8-27B-GGUF/resolve/main/BF16/Qwen3.8-27B-BF16-00001-of-00002.gguf",
            "fileName": "Qwen3.8-27B-BF16-00001-of-00002.gguf",
            "sizeBytes": 49986159616
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.8-27B-GGUF/resolve/main/BF16/Qwen3.8-27B-BF16-00002-of-00002.gguf",
            "fileName": "Qwen3.8-27B-BF16-00002-of-00002.gguf",
            "sizeBytes": 4671576000
          }
        ]
      }
    ]
  },
  {
    "id": "qwen3-coder-30b-a3b",
    "name": "Qwen3 Coder 30B A3B",
    "description": "Spezielles Coding-Agent-Modell als MoE – schnell und gut mit Werkzeugen.",
    "repo": "unsloth/Qwen3-Coder-30B-A3B-Instruct-GGUF",
    "sizeClass": "mittel",
    "totalParamsB": 30.5,
    "activeParamsB": 3.3,
    "tags": [
      "Code",
      "Agent",
      "schnell",
      "MoE"
    ],
    "license": {
      "name": "Apache 2.0",
      "url": "https://huggingface.co/Qwen/Qwen3-Coder-30B-A3B-Instruct/blob/main/LICENSE",
      "commercial": true
    },
    "recommendedVariant": "qwen3-coder-30b-a3b:Q4_K_M",
    "variants": [
      {
        "id": "qwen3-coder-30b-a3b:Q3_K_M",
        "quant": "Q3_K_M",
        "label": "3-Bit – klein, leichte Einbußen",
        "sizeBytes": 14711850144,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-30B-A3B-Instruct-GGUF/resolve/main/Qwen3-Coder-30B-A3B-Instruct-Q3_K_M.gguf",
            "fileName": "Qwen3-Coder-30B-A3B-Instruct-Q3_K_M.gguf",
            "sizeBytes": 14711850144
          }
        ]
      },
      {
        "id": "qwen3-coder-30b-a3b:Q4_K_M",
        "quant": "Q4_K_M",
        "label": "4-Bit – empfohlen: schnell, kaum Qualitätsverlust",
        "sizeBytes": 18556689568,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-30B-A3B-Instruct-GGUF/resolve/main/Qwen3-Coder-30B-A3B-Instruct-Q4_K_M.gguf",
            "fileName": "Qwen3-Coder-30B-A3B-Instruct-Q4_K_M.gguf",
            "sizeBytes": 18556689568
          }
        ]
      },
      {
        "id": "qwen3-coder-30b-a3b:Q6_K",
        "quant": "Q6_K",
        "label": "6-Bit – sehr gute Qualität",
        "sizeBytes": 25092535456,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-30B-A3B-Instruct-GGUF/resolve/main/Qwen3-Coder-30B-A3B-Instruct-Q6_K.gguf",
            "fileName": "Qwen3-Coder-30B-A3B-Instruct-Q6_K.gguf",
            "sizeBytes": 25092535456
          }
        ]
      },
      {
        "id": "qwen3-coder-30b-a3b:Q8_0",
        "quant": "Q8_0",
        "label": "8-Bit – nahezu verlustfrei",
        "sizeBytes": 32483935392,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-30B-A3B-Instruct-GGUF/resolve/main/Qwen3-Coder-30B-A3B-Instruct-Q8_0.gguf",
            "fileName": "Qwen3-Coder-30B-A3B-Instruct-Q8_0.gguf",
            "sizeBytes": 32483935392
          }
        ]
      },
      {
        "id": "qwen3-coder-30b-a3b:BF16",
        "quant": "BF16",
        "label": "16-Bit – Original, unquantisiert (groß und langsamer)",
        "sizeBytes": 61095806048,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-30B-A3B-Instruct-GGUF/resolve/main/BF16/Qwen3-Coder-30B-A3B-Instruct-BF16-00001-of-00002.gguf",
            "fileName": "Qwen3-Coder-30B-A3B-Instruct-BF16-00001-of-00002.gguf",
            "sizeBytes": 49655154016
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-30B-A3B-Instruct-GGUF/resolve/main/BF16/Qwen3-Coder-30B-A3B-Instruct-BF16-00002-of-00002.gguf",
            "fileName": "Qwen3-Coder-30B-A3B-Instruct-BF16-00002-of-00002.gguf",
            "sizeBytes": 11440652032
          }
        ]
      }
    ]
  },
  {
    "id": "gemma-4-31b",
    "name": "Gemma 4 31B",
    "description": "Größtes Gemma 4, dicht – hohe Qualität, braucht viel Speicher.",
    "repo": "unsloth/gemma-4-31B-it-GGUF",
    "sizeClass": "mittel",
    "totalParamsB": 30.7,
    "activeParamsB": 30.7,
    "tags": [
      "Allround",
      "Qualität"
    ],
    "license": {
      "name": "Apache 2.0",
      "url": "https://huggingface.co/google/gemma-4-31B-it/blob/main/LICENSE",
      "commercial": true
    },
    "recommendedVariant": "gemma-4-31b:Q4_K_M",
    "variants": [
      {
        "id": "gemma-4-31b:Q3_K_M",
        "quant": "Q3_K_M",
        "label": "3-Bit – klein, leichte Einbußen",
        "sizeBytes": 14736608192,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/gemma-4-31B-it-GGUF/resolve/main/gemma-4-31B-it-Q3_K_M.gguf",
            "fileName": "gemma-4-31B-it-Q3_K_M.gguf",
            "sizeBytes": 14736608192
          }
        ]
      },
      {
        "id": "gemma-4-31b:Q4_K_M",
        "quant": "Q4_K_M",
        "label": "4-Bit – empfohlen: schnell, kaum Qualitätsverlust",
        "sizeBytes": 18323733440,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/gemma-4-31B-it-GGUF/resolve/main/gemma-4-31B-it-Q4_K_M.gguf",
            "fileName": "gemma-4-31B-it-Q4_K_M.gguf",
            "sizeBytes": 18323733440
          }
        ]
      },
      {
        "id": "gemma-4-31b:Q6_K",
        "quant": "Q6_K",
        "label": "6-Bit – sehr gute Qualität",
        "sizeBytes": 25201486784,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/gemma-4-31B-it-GGUF/resolve/main/gemma-4-31B-it-Q6_K.gguf",
            "fileName": "gemma-4-31B-it-Q6_K.gguf",
            "sizeBytes": 25201486784
          }
        ]
      },
      {
        "id": "gemma-4-31b:Q8_0",
        "quant": "Q8_0",
        "label": "8-Bit – nahezu verlustfrei",
        "sizeBytes": 32635677632,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/gemma-4-31B-it-GGUF/resolve/main/gemma-4-31B-it-Q8_0.gguf",
            "fileName": "gemma-4-31B-it-Q8_0.gguf",
            "sizeBytes": 32635677632
          }
        ]
      },
      {
        "id": "gemma-4-31b:BF16",
        "quant": "BF16",
        "label": "16-Bit – Original, unquantisiert (groß und langsamer)",
        "sizeBytes": 61413190528,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/gemma-4-31B-it-GGUF/resolve/main/BF16/gemma-4-31B-it-BF16-00001-of-00002.gguf",
            "fileName": "gemma-4-31B-it-BF16-00001-of-00002.gguf",
            "sizeBytes": 49950156960
          },
          {
            "url": "https://huggingface.co/unsloth/gemma-4-31B-it-GGUF/resolve/main/BF16/gemma-4-31B-it-BF16-00002-of-00002.gguf",
            "fileName": "gemma-4-31B-it-BF16-00002-of-00002.gguf",
            "sizeBytes": 11463033568
          }
        ]
      }
    ]
  },
  {
    "id": "qwen3.6-35b-a3b",
    "name": "Qwen3.6 35B A3B",
    "description": "Sehr beliebter MoE-Allrounder: groß im Wissen, schnell wie ein 3B-Modell.",
    "repo": "unsloth/Qwen3.6-35B-A3B-GGUF",
    "sizeClass": "mittel",
    "totalParamsB": 34.7,
    "activeParamsB": 3,
    "tags": [
      "Allround",
      "Code",
      "schnell",
      "MoE"
    ],
    "license": {
      "name": "Apache 2.0",
      "url": "https://huggingface.co/Qwen/Qwen3.6-35B-A3B/blob/main/LICENSE",
      "commercial": true
    },
    "recommendedVariant": "qwen3.6-35b-a3b:UD-Q4_K_M",
    "variants": [
      {
        "id": "qwen3.6-35b-a3b:UD-Q3_K_M",
        "quant": "UD-Q3_K_M",
        "label": "3-Bit (Unsloth Dynamic) – klein, leichte Einbußen",
        "sizeBytes": 16600710112,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/Qwen3.6-35B-A3B-GGUF/resolve/main/Qwen3.6-35B-A3B-UD-Q3_K_M.gguf",
            "fileName": "Qwen3.6-35B-A3B-UD-Q3_K_M.gguf",
            "sizeBytes": 16600710112
          }
        ]
      },
      {
        "id": "qwen3.6-35b-a3b:UD-Q4_K_M",
        "quant": "UD-Q4_K_M",
        "label": "4-Bit (Unsloth Dynamic) – empfohlen: schnell, kaum Qualitätsverlust",
        "sizeBytes": 22134528992,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/Qwen3.6-35B-A3B-GGUF/resolve/main/Qwen3.6-35B-A3B-UD-Q4_K_M.gguf",
            "fileName": "Qwen3.6-35B-A3B-UD-Q4_K_M.gguf",
            "sizeBytes": 22134528992
          }
        ]
      },
      {
        "id": "qwen3.6-35b-a3b:UD-Q6_K",
        "quant": "UD-Q6_K",
        "label": "6-Bit (Unsloth Dynamic) – sehr gute Qualität",
        "sizeBytes": 29308320736,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/Qwen3.6-35B-A3B-GGUF/resolve/main/Qwen3.6-35B-A3B-UD-Q6_K.gguf",
            "fileName": "Qwen3.6-35B-A3B-UD-Q6_K.gguf",
            "sizeBytes": 29308320736
          }
        ]
      },
      {
        "id": "qwen3.6-35b-a3b:Q8_0",
        "quant": "Q8_0",
        "label": "8-Bit – nahezu verlustfrei",
        "sizeBytes": 36903140320,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/Qwen3.6-35B-A3B-GGUF/resolve/main/Qwen3.6-35B-A3B-Q8_0.gguf",
            "fileName": "Qwen3.6-35B-A3B-Q8_0.gguf",
            "sizeBytes": 36903140320
          }
        ]
      },
      {
        "id": "qwen3.6-35b-a3b:BF16",
        "quant": "BF16",
        "label": "16-Bit – Original, unquantisiert (groß und langsamer)",
        "sizeBytes": 69376638176,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/Qwen3.6-35B-A3B-GGUF/resolve/main/BF16/Qwen3.6-35B-A3B-BF16-00001-of-00002.gguf",
            "fileName": "Qwen3.6-35B-A3B-BF16-00001-of-00002.gguf",
            "sizeBytes": 49913715424
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.6-35B-A3B-GGUF/resolve/main/BF16/Qwen3.6-35B-A3B-BF16-00002-of-00002.gguf",
            "fileName": "Qwen3.6-35B-A3B-BF16-00002-of-00002.gguf",
            "sizeBytes": 19462922752
          }
        ]
      }
    ]
  },
  {
    "id": "qwen3-coder-next",
    "name": "Qwen3 Coder Next 80B",
    "description": "Großes Coding-Agent-Modell, als MoE trotzdem schnell.",
    "repo": "unsloth/Qwen3-Coder-Next-GGUF",
    "sizeClass": "groß",
    "totalParamsB": 79.7,
    "activeParamsB": 3,
    "tags": [
      "Code",
      "Agent",
      "MoE"
    ],
    "license": {
      "name": "Apache 2.0",
      "url": "https://huggingface.co/Qwen/Qwen3-Coder-Next/blob/main/LICENSE",
      "commercial": true
    },
    "recommendedVariant": "qwen3-coder-next:Q4_K_M",
    "variants": [
      {
        "id": "qwen3-coder-next:UD-Q2_K_XL",
        "quant": "UD-Q2_K_XL",
        "label": "2-Bit (Unsloth Dynamic) – passt noch am ehesten, spürbar schwächer",
        "sizeBytes": 26760515584,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-Next-GGUF/resolve/main/Qwen3-Coder-Next-UD-Q2_K_XL.gguf",
            "fileName": "Qwen3-Coder-Next-UD-Q2_K_XL.gguf",
            "sizeBytes": 26760515584
          }
        ]
      },
      {
        "id": "qwen3-coder-next:Q3_K_M",
        "quant": "Q3_K_M",
        "label": "3-Bit – klein, leichte Einbußen",
        "sizeBytes": 38322487328,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-Next-GGUF/resolve/main/Qwen3-Coder-Next-Q3_K_M.gguf",
            "fileName": "Qwen3-Coder-Next-Q3_K_M.gguf",
            "sizeBytes": 38322487328
          }
        ]
      },
      {
        "id": "qwen3-coder-next:Q4_K_M",
        "quant": "Q4_K_M",
        "label": "4-Bit – empfohlen: schnell, kaum Qualitätsverlust",
        "sizeBytes": 48528320544,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-Next-GGUF/resolve/main/Qwen3-Coder-Next-Q4_K_M.gguf",
            "fileName": "Qwen3-Coder-Next-Q4_K_M.gguf",
            "sizeBytes": 48528320544
          }
        ]
      },
      {
        "id": "qwen3-coder-next:Q6_K",
        "quant": "Q6_K",
        "label": "6-Bit – sehr gute Qualität",
        "sizeBytes": 65613992288,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-Next-GGUF/resolve/main/Q6_K/Qwen3-Coder-Next-Q6_K-00001-of-00003.gguf",
            "fileName": "Qwen3-Coder-Next-Q6_K-00001-of-00003.gguf",
            "sizeBytes": 5936320
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-Next-GGUF/resolve/main/Q6_K/Qwen3-Coder-Next-Q6_K-00002-of-00003.gguf",
            "fileName": "Qwen3-Coder-Next-Q6_K-00002-of-00003.gguf",
            "sizeBytes": 49795838592
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-Next-GGUF/resolve/main/Q6_K/Qwen3-Coder-Next-Q6_K-00003-of-00003.gguf",
            "fileName": "Qwen3-Coder-Next-Q6_K-00003-of-00003.gguf",
            "sizeBytes": 15812217376
          }
        ]
      },
      {
        "id": "qwen3-coder-next:Q8_0",
        "quant": "Q8_0",
        "label": "8-Bit – nahezu verlustfrei",
        "sizeBytes": 84812255584,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-Next-GGUF/resolve/main/Q8_0/Qwen3-Coder-Next-Q8_0-00001-of-00003.gguf",
            "fileName": "Qwen3-Coder-Next-Q8_0-00001-of-00003.gguf",
            "sizeBytes": 5936288
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-Next-GGUF/resolve/main/Q8_0/Qwen3-Coder-Next-Q8_0-00002-of-00003.gguf",
            "fileName": "Qwen3-Coder-Next-Q8_0-00002-of-00003.gguf",
            "sizeBytes": 49772613984
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-Next-GGUF/resolve/main/Q8_0/Qwen3-Coder-Next-Q8_0-00003-of-00003.gguf",
            "fileName": "Qwen3-Coder-Next-Q8_0-00003-of-00003.gguf",
            "sizeBytes": 35033705312
          }
        ]
      },
      {
        "id": "qwen3-coder-next:BF16",
        "quant": "BF16",
        "label": "16-Bit – Original, unquantisiert (groß und langsamer)",
        "sizeBytes": 159458415168,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-Next-GGUF/resolve/main/BF16/Qwen3-Coder-Next-BF16-00001-of-00004.gguf",
            "fileName": "Qwen3-Coder-Next-BF16-00001-of-00004.gguf",
            "sizeBytes": 49004195968
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-Next-GGUF/resolve/main/BF16/Qwen3-Coder-Next-BF16-00002-of-00004.gguf",
            "fileName": "Qwen3-Coder-Next-BF16-00002-of-00004.gguf",
            "sizeBytes": 49426194752
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-Next-GGUF/resolve/main/BF16/Qwen3-Coder-Next-BF16-00003-of-00004.gguf",
            "fileName": "Qwen3-Coder-Next-BF16-00003-of-00004.gguf",
            "sizeBytes": 49447199840
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-Next-GGUF/resolve/main/BF16/Qwen3-Coder-Next-BF16-00004-of-00004.gguf",
            "fileName": "Qwen3-Coder-Next-BF16-00004-of-00004.gguf",
            "sizeBytes": 11580824608
          }
        ]
      }
    ]
  },
  {
    "id": "gpt-oss-120b",
    "name": "gpt-oss 120B",
    "description": "Großes offenes OpenAI-Modell, rechnet nur 5,1B pro Wort.",
    "repo": "ggml-org/gpt-oss-120b-GGUF",
    "sizeClass": "groß",
    "totalParamsB": 116.8,
    "activeParamsB": 5.1,
    "tags": [
      "Reasoning",
      "MoE"
    ],
    "license": {
      "name": "Apache 2.0",
      "url": "https://huggingface.co/openai/gpt-oss-120b/blob/main/LICENSE",
      "commercial": true
    },
    "recommendedVariant": "gpt-oss-120b:MXFP4",
    "variants": [
      {
        "id": "gpt-oss-120b:MXFP4",
        "quant": "MXFP4",
        "label": "MXFP4 – Originalformat, so wurde das Modell trainiert",
        "sizeBytes": 63387346208,
        "files": [
          {
            "url": "https://huggingface.co/ggml-org/gpt-oss-120b-GGUF/resolve/main/gpt-oss-120b-MXFP4.gguf",
            "fileName": "gpt-oss-120b-MXFP4.gguf",
            "sizeBytes": 63387346208
          }
        ]
      }
    ]
  },
  {
    "id": "qwen3.8-flash-next",
    "name": "Qwen3.8 Flash-Next 177B",
    "description": "Neuestes großes Qwen-MoE mit 512 Experten, auf Tempo getrimmt.",
    "repo": "unsloth/Qwen3.8-Flash-Next-GGUF",
    "sizeClass": "groß",
    "totalParamsB": 176.9,
    "activeParamsB": 7,
    "tags": [
      "Allround",
      "Code",
      "MoE"
    ],
    "license": {
      "name": "Qwen Community License 1.0",
      "url": "https://huggingface.co/Qwen/Qwen3.8-Flash-Next/blob/main/LICENSE",
      "commercial": false,
      "note": "Privat und intern frei. Wer kommerziell ein KI-Coding-/Büro-Produkt (wie diese IDE) oder eine Modell-API anbietet, braucht eine eigene Lizenz von Qwen."
    },
    "recommendedVariant": "qwen3.8-flash-next:UD-Q4_K_XL",
    "variants": [
      {
        "id": "qwen3.8-flash-next:UD-Q2_K_XL",
        "quant": "UD-Q2_K_XL",
        "label": "2-Bit (Unsloth Dynamic) – passt noch am ehesten, spürbar schwächer",
        "sizeBytes": 78869128864,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/Qwen3.8-Flash-Next-GGUF/resolve/main/UD-Q2_K_XL/Qwen3.8-Flash-Next-UD-Q2_K_XL-00001-of-00003.gguf",
            "fileName": "Qwen3.8-Flash-Next-UD-Q2_K_XL-00001-of-00003.gguf",
            "sizeBytes": 10946624
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.8-Flash-Next-GGUF/resolve/main/UD-Q2_K_XL/Qwen3.8-Flash-Next-UD-Q2_K_XL-00002-of-00003.gguf",
            "fileName": "Qwen3.8-Flash-Next-UD-Q2_K_XL-00002-of-00003.gguf",
            "sizeBytes": 49979779296
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.8-Flash-Next-GGUF/resolve/main/UD-Q2_K_XL/Qwen3.8-Flash-Next-UD-Q2_K_XL-00003-of-00003.gguf",
            "fileName": "Qwen3.8-Flash-Next-UD-Q2_K_XL-00003-of-00003.gguf",
            "sizeBytes": 28878402944
          }
        ]
      },
      {
        "id": "qwen3.8-flash-next:UD-Q3_K_XL",
        "quant": "UD-Q3_K_XL",
        "label": "3-Bit (Unsloth Dynamic) – klein, leichte Einbußen",
        "sizeBytes": 89986353824,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/Qwen3.8-Flash-Next-GGUF/resolve/main/UD-Q3_K_XL/Qwen3.8-Flash-Next-UD-Q3_K_XL-00001-of-00003.gguf",
            "fileName": "Qwen3.8-Flash-Next-UD-Q3_K_XL-00001-of-00003.gguf",
            "sizeBytes": 10946624
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.8-Flash-Next-GGUF/resolve/main/UD-Q3_K_XL/Qwen3.8-Flash-Next-UD-Q3_K_XL-00002-of-00003.gguf",
            "fileName": "Qwen3.8-Flash-Next-UD-Q3_K_XL-00002-of-00003.gguf",
            "sizeBytes": 49983253824
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.8-Flash-Next-GGUF/resolve/main/UD-Q3_K_XL/Qwen3.8-Flash-Next-UD-Q3_K_XL-00003-of-00003.gguf",
            "fileName": "Qwen3.8-Flash-Next-UD-Q3_K_XL-00003-of-00003.gguf",
            "sizeBytes": 39992153376
          }
        ]
      },
      {
        "id": "qwen3.8-flash-next:UD-Q4_K_XL",
        "quant": "UD-Q4_K_XL",
        "label": "4-Bit (Unsloth Dynamic) – empfohlen: schnell, kaum Qualitätsverlust",
        "sizeBytes": 111334654784,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/Qwen3.8-Flash-Next-GGUF/resolve/main/UD-Q4_K_XL/Qwen3.8-Flash-Next-UD-Q4_K_XL-00001-of-00004.gguf",
            "fileName": "Qwen3.8-Flash-Next-UD-Q4_K_XL-00001-of-00004.gguf",
            "sizeBytes": 10946624
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.8-Flash-Next-GGUF/resolve/main/UD-Q4_K_XL/Qwen3.8-Flash-Next-UD-Q4_K_XL-00002-of-00004.gguf",
            "fileName": "Qwen3.8-Flash-Next-UD-Q4_K_XL-00002-of-00004.gguf",
            "sizeBytes": 49859583136
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.8-Flash-Next-GGUF/resolve/main/UD-Q4_K_XL/Qwen3.8-Flash-Next-UD-Q4_K_XL-00003-of-00004.gguf",
            "fileName": "Qwen3.8-Flash-Next-UD-Q4_K_XL-00003-of-00004.gguf",
            "sizeBytes": 49376141504
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.8-Flash-Next-GGUF/resolve/main/UD-Q4_K_XL/Qwen3.8-Flash-Next-UD-Q4_K_XL-00004-of-00004.gguf",
            "fileName": "Qwen3.8-Flash-Next-UD-Q4_K_XL-00004-of-00004.gguf",
            "sizeBytes": 12087983520
          }
        ]
      },
      {
        "id": "qwen3.8-flash-next:UD-Q6_K_XL",
        "quant": "UD-Q6_K_XL",
        "label": "6-Bit (Unsloth Dynamic) – sehr gute Qualität",
        "sizeBytes": 169165382688,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/Qwen3.8-Flash-Next-GGUF/resolve/main/UD-Q6_K_XL/Qwen3.8-Flash-Next-UD-Q6_K_XL-00001-of-00006.gguf",
            "fileName": "Qwen3.8-Flash-Next-UD-Q6_K_XL-00001-of-00006.gguf",
            "sizeBytes": 10946624
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.8-Flash-Next-GGUF/resolve/main/UD-Q6_K_XL/Qwen3.8-Flash-Next-UD-Q6_K_XL-00002-of-00006.gguf",
            "fileName": "Qwen3.8-Flash-Next-UD-Q6_K_XL-00002-of-00006.gguf",
            "sizeBytes": 682434912
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.8-Flash-Next-GGUF/resolve/main/UD-Q6_K_XL/Qwen3.8-Flash-Next-UD-Q6_K_XL-00003-of-00006.gguf",
            "fileName": "Qwen3.8-Flash-Next-UD-Q6_K_XL-00003-of-00006.gguf",
            "sizeBytes": 54400261312
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.8-Flash-Next-GGUF/resolve/main/UD-Q6_K_XL/Qwen3.8-Flash-Next-UD-Q6_K_XL-00004-of-00006.gguf",
            "fileName": "Qwen3.8-Flash-Next-UD-Q6_K_XL-00004-of-00006.gguf",
            "sizeBytes": 49814108512
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.8-Flash-Next-GGUF/resolve/main/UD-Q6_K_XL/Qwen3.8-Flash-Next-UD-Q6_K_XL-00005-of-00006.gguf",
            "fileName": "Qwen3.8-Flash-Next-UD-Q6_K_XL-00005-of-00006.gguf",
            "sizeBytes": 49419317344
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.8-Flash-Next-GGUF/resolve/main/UD-Q6_K_XL/Qwen3.8-Flash-Next-UD-Q6_K_XL-00006-of-00006.gguf",
            "fileName": "Qwen3.8-Flash-Next-UD-Q6_K_XL-00006-of-00006.gguf",
            "sizeBytes": 14838313984
          }
        ]
      },
      {
        "id": "qwen3.8-flash-next:Q8_0",
        "quant": "Q8_0",
        "label": "8-Bit – nahezu verlustfrei",
        "sizeBytes": 188225033248,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/Qwen3.8-Flash-Next-GGUF/resolve/main/Q8_0/Qwen3.8-Flash-Next-Q8_0-00001-of-00006.gguf",
            "fileName": "Qwen3.8-Flash-Next-Q8_0-00001-of-00006.gguf",
            "sizeBytes": 10946624
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.8-Flash-Next-GGUF/resolve/main/Q8_0/Qwen3.8-Flash-Next-Q8_0-00002-of-00006.gguf",
            "fileName": "Qwen3.8-Flash-Next-Q8_0-00002-of-00006.gguf",
            "sizeBytes": 682434912
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.8-Flash-Next-GGUF/resolve/main/Q8_0/Qwen3.8-Flash-Next-Q8_0-00003-of-00006.gguf",
            "fileName": "Qwen3.8-Flash-Next-Q8_0-00003-of-00006.gguf",
            "sizeBytes": 54400261312
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.8-Flash-Next-GGUF/resolve/main/Q8_0/Qwen3.8-Flash-Next-Q8_0-00004-of-00006.gguf",
            "fileName": "Qwen3.8-Flash-Next-Q8_0-00004-of-00006.gguf",
            "sizeBytes": 49446841216
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.8-Flash-Next-GGUF/resolve/main/Q8_0/Qwen3.8-Flash-Next-Q8_0-00005-of-00006.gguf",
            "fileName": "Qwen3.8-Flash-Next-Q8_0-00005-of-00006.gguf",
            "sizeBytes": 49668930400
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.8-Flash-Next-GGUF/resolve/main/Q8_0/Qwen3.8-Flash-Next-Q8_0-00006-of-00006.gguf",
            "fileName": "Qwen3.8-Flash-Next-Q8_0-00006-of-00006.gguf",
            "sizeBytes": 34015618784
          }
        ]
      },
      {
        "id": "qwen3.8-flash-next:BF16",
        "quant": "BF16",
        "label": "16-Bit – Original, unquantisiert (groß und langsamer)",
        "sizeBytes": 354029930496,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/Qwen3.8-Flash-Next-GGUF/resolve/main/BF16/Qwen3.8-Flash-Next-BF16-00001-of-00008.gguf",
            "fileName": "Qwen3.8-Flash-Next-BF16-00001-of-00008.gguf",
            "sizeBytes": 10946368
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.8-Flash-Next-GGUF/resolve/main/BF16/Qwen3.8-Flash-Next-BF16-00002-of-00008.gguf",
            "fileName": "Qwen3.8-Flash-Next-BF16-00002-of-00008.gguf",
            "sizeBytes": 10447201664
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.8-Flash-Next-GGUF/resolve/main/BF16/Qwen3.8-Flash-Next-BF16-00003-of-00008.gguf",
            "fileName": "Qwen3.8-Flash-Next-BF16-00003-of-00008.gguf",
            "sizeBytes": 102400491712
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.8-Flash-Next-GGUF/resolve/main/BF16/Qwen3.8-Flash-Next-BF16-00004-of-00008.gguf",
            "fileName": "Qwen3.8-Flash-Next-BF16-00004-of-00008.gguf",
            "sizeBytes": 48394236672
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.8-Flash-Next-GGUF/resolve/main/BF16/Qwen3.8-Flash-Next-BF16-00005-of-00008.gguf",
            "fileName": "Qwen3.8-Flash-Next-BF16-00005-of-00008.gguf",
            "sizeBytes": 48367899040
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.8-Flash-Next-GGUF/resolve/main/BF16/Qwen3.8-Flash-Next-BF16-00006-of-00008.gguf",
            "fileName": "Qwen3.8-Flash-Next-BF16-00006-of-00008.gguf",
            "sizeBytes": 48615233984
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.8-Flash-Next-GGUF/resolve/main/BF16/Qwen3.8-Flash-Next-BF16-00007-of-00008.gguf",
            "fileName": "Qwen3.8-Flash-Next-BF16-00007-of-00008.gguf",
            "sizeBytes": 48367899040
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.8-Flash-Next-GGUF/resolve/main/BF16/Qwen3.8-Flash-Next-BF16-00008-of-00008.gguf",
            "fileName": "Qwen3.8-Flash-Next-BF16-00008-of-00008.gguf",
            "sizeBytes": 47426022016
          }
        ]
      }
    ]
  },
  {
    "id": "qwen3.5-397b-a17b",
    "name": "Qwen3.5 397B A17B",
    "description": "Flaggschiff-Klasse für Workstations. Rechnet 17B pro Wort.",
    "repo": "unsloth/Qwen3.5-397B-A17B-GGUF",
    "sizeClass": "riesig",
    "totalParamsB": 397,
    "activeParamsB": 17,
    "tags": [
      "Allround",
      "Qualität",
      "MoE"
    ],
    "license": {
      "name": "Apache 2.0",
      "url": "https://huggingface.co/Qwen/Qwen3.5-397B-A17B/blob/main/LICENSE",
      "commercial": true
    },
    "recommendedVariant": "qwen3.5-397b-a17b:Q4_K_M",
    "variants": [
      {
        "id": "qwen3.5-397b-a17b:UD-IQ2_M",
        "quant": "UD-IQ2_M",
        "label": "2-Bit (Unsloth Dynamic) – passt noch am ehesten, spürbar schwächer",
        "sizeBytes": 123053144288,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-397B-A17B-GGUF/resolve/main/UD-IQ2_M/Qwen3.5-397B-A17B-UD-IQ2_M-00001-of-00004.gguf",
            "fileName": "Qwen3.5-397B-A17B-UD-IQ2_M-00001-of-00004.gguf",
            "sizeBytes": 10943552
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-397B-A17B-GGUF/resolve/main/UD-IQ2_M/Qwen3.5-397B-A17B-UD-IQ2_M-00002-of-00004.gguf",
            "fileName": "Qwen3.5-397B-A17B-UD-IQ2_M-00002-of-00004.gguf",
            "sizeBytes": 49979729120
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-397B-A17B-GGUF/resolve/main/UD-IQ2_M/Qwen3.5-397B-A17B-UD-IQ2_M-00003-of-00004.gguf",
            "fileName": "Qwen3.5-397B-A17B-UD-IQ2_M-00003-of-00004.gguf",
            "sizeBytes": 49591526976
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-397B-A17B-GGUF/resolve/main/UD-IQ2_M/Qwen3.5-397B-A17B-UD-IQ2_M-00004-of-00004.gguf",
            "fileName": "Qwen3.5-397B-A17B-UD-IQ2_M-00004-of-00004.gguf",
            "sizeBytes": 23470944640
          }
        ]
      },
      {
        "id": "qwen3.5-397b-a17b:Q3_K_M",
        "quant": "Q3_K_M",
        "label": "3-Bit – klein, leichte Einbußen",
        "sizeBytes": 177409522016,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-397B-A17B-GGUF/resolve/main/Q3_K_M/Qwen3.5-397B-A17B-Q3_K_M-00001-of-00005.gguf",
            "fileName": "Qwen3.5-397B-A17B-Q3_K_M-00001-of-00005.gguf",
            "sizeBytes": 10943552
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-397B-A17B-GGUF/resolve/main/Q3_K_M/Qwen3.5-397B-A17B-Q3_K_M-00002-of-00005.gguf",
            "fileName": "Qwen3.5-397B-A17B-Q3_K_M-00002-of-00005.gguf",
            "sizeBytes": 49764473344
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-397B-A17B-GGUF/resolve/main/Q3_K_M/Qwen3.5-397B-A17B-Q3_K_M-00003-of-00005.gguf",
            "fileName": "Qwen3.5-397B-A17B-Q3_K_M-00003-of-00005.gguf",
            "sizeBytes": 49793655168
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-397B-A17B-GGUF/resolve/main/Q3_K_M/Qwen3.5-397B-A17B-Q3_K_M-00004-of-00005.gguf",
            "fileName": "Qwen3.5-397B-A17B-Q3_K_M-00004-of-00005.gguf",
            "sizeBytes": 49793655168
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-397B-A17B-GGUF/resolve/main/Q3_K_M/Qwen3.5-397B-A17B-Q3_K_M-00005-of-00005.gguf",
            "fileName": "Qwen3.5-397B-A17B-Q3_K_M-00005-of-00005.gguf",
            "sizeBytes": 28046794784
          }
        ]
      },
      {
        "id": "qwen3.5-397b-a17b:Q4_K_M",
        "quant": "Q4_K_M",
        "label": "4-Bit – empfohlen: schnell, kaum Qualitätsverlust",
        "sizeBytes": 244093630912,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-397B-A17B-GGUF/resolve/main/Q4_K_M/Qwen3.5-397B-A17B-Q4_K_M-00001-of-00006.gguf",
            "fileName": "Qwen3.5-397B-A17B-Q4_K_M-00001-of-00006.gguf",
            "sizeBytes": 10943552
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-397B-A17B-GGUF/resolve/main/Q4_K_M/Qwen3.5-397B-A17B-Q4_K_M-00002-of-00006.gguf",
            "fileName": "Qwen3.5-397B-A17B-Q4_K_M-00002-of-00006.gguf",
            "sizeBytes": 49136153056
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-397B-A17B-GGUF/resolve/main/Q4_K_M/Qwen3.5-397B-A17B-Q4_K_M-00003-of-00006.gguf",
            "fileName": "Qwen3.5-397B-A17B-Q4_K_M-00003-of-00006.gguf",
            "sizeBytes": 49735103552
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-397B-A17B-GGUF/resolve/main/Q4_K_M/Qwen3.5-397B-A17B-Q4_K_M-00004-of-00006.gguf",
            "fileName": "Qwen3.5-397B-A17B-Q4_K_M-00004-of-00006.gguf",
            "sizeBytes": 49914377024
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-397B-A17B-GGUF/resolve/main/Q4_K_M/Qwen3.5-397B-A17B-Q4_K_M-00005-of-00006.gguf",
            "fileName": "Qwen3.5-397B-A17B-Q4_K_M-00005-of-00006.gguf",
            "sizeBytes": 49654346688
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-397B-A17B-GGUF/resolve/main/Q4_K_M/Qwen3.5-397B-A17B-Q4_K_M-00006-of-00006.gguf",
            "fileName": "Qwen3.5-397B-A17B-Q4_K_M-00006-of-00006.gguf",
            "sizeBytes": 45642707040
          }
        ]
      },
      {
        "id": "qwen3.5-397b-a17b:Q6_K",
        "quant": "Q6_K",
        "label": "6-Bit – sehr gute Qualität",
        "sizeBytes": 326595345056,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-397B-A17B-GGUF/resolve/main/Q6_K/Qwen3.5-397B-A17B-Q6_K-00001-of-00008.gguf",
            "fileName": "Qwen3.5-397B-A17B-Q6_K-00001-of-00008.gguf",
            "sizeBytes": 10943552
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-397B-A17B-GGUF/resolve/main/Q6_K/Qwen3.5-397B-A17B-Q6_K-00002-of-00008.gguf",
            "fileName": "Qwen3.5-397B-A17B-Q6_K-00002-of-00008.gguf",
            "sizeBytes": 49027157760
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-397B-A17B-GGUF/resolve/main/Q6_K/Qwen3.5-397B-A17B-Q6_K-00003-of-00008.gguf",
            "fileName": "Qwen3.5-397B-A17B-Q6_K-00003-of-00008.gguf",
            "sizeBytes": 48668251456
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-397B-A17B-GGUF/resolve/main/Q6_K/Qwen3.5-397B-A17B-Q6_K-00004-of-00008.gguf",
            "fileName": "Qwen3.5-397B-A17B-Q6_K-00004-of-00008.gguf",
            "sizeBytes": 48668251456
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-397B-A17B-GGUF/resolve/main/Q6_K/Qwen3.5-397B-A17B-Q6_K-00005-of-00008.gguf",
            "fileName": "Qwen3.5-397B-A17B-Q6_K-00005-of-00008.gguf",
            "sizeBytes": 48685456960
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-397B-A17B-GGUF/resolve/main/Q6_K/Qwen3.5-397B-A17B-Q6_K-00006-of-00008.gguf",
            "fileName": "Qwen3.5-397B-A17B-Q6_K-00006-of-00008.gguf",
            "sizeBytes": 48631844800
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-397B-A17B-GGUF/resolve/main/Q6_K/Qwen3.5-397B-A17B-Q6_K-00007-of-00008.gguf",
            "fileName": "Qwen3.5-397B-A17B-Q6_K-00007-of-00008.gguf",
            "sizeBytes": 48668251456
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-397B-A17B-GGUF/resolve/main/Q6_K/Qwen3.5-397B-A17B-Q6_K-00008-of-00008.gguf",
            "fileName": "Qwen3.5-397B-A17B-Q6_K-00008-of-00008.gguf",
            "sizeBytes": 34235187616
          }
        ]
      },
      {
        "id": "qwen3.5-397b-a17b:Q8_0",
        "quant": "Q8_0",
        "label": "8-Bit – nahezu verlustfrei",
        "sizeBytes": 421507365824,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-397B-A17B-GGUF/resolve/main/Q8_0/Qwen3.5-397B-A17B-Q8_0-00001-of-00010.gguf",
            "fileName": "Qwen3.5-397B-A17B-Q8_0-00001-of-00010.gguf",
            "sizeBytes": 10943552
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-397B-A17B-GGUF/resolve/main/Q8_0/Qwen3.5-397B-A17B-Q8_0-00002-of-00010.gguf",
            "fileName": "Qwen3.5-397B-A17B-Q8_0-00002-of-00010.gguf",
            "sizeBytes": 48771824224
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-397B-A17B-GGUF/resolve/main/Q8_0/Qwen3.5-397B-A17B-Q8_0-00003-of-00010.gguf",
            "fileName": "Qwen3.5-397B-A17B-Q8_0-00003-of-00010.gguf",
            "sizeBytes": 48918889408
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-397B-A17B-GGUF/resolve/main/Q8_0/Qwen3.5-397B-A17B-Q8_0-00004-of-00010.gguf",
            "fileName": "Qwen3.5-397B-A17B-Q8_0-00004-of-00010.gguf",
            "sizeBytes": 48918889472
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-397B-A17B-GGUF/resolve/main/Q8_0/Qwen3.5-397B-A17B-Q8_0-00005-of-00010.gguf",
            "fileName": "Qwen3.5-397B-A17B-Q8_0-00005-of-00010.gguf",
            "sizeBytes": 48955296128
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-397B-A17B-GGUF/resolve/main/Q8_0/Qwen3.5-397B-A17B-Q8_0-00006-of-00010.gguf",
            "fileName": "Qwen3.5-397B-A17B-Q8_0-00006-of-00010.gguf",
            "sizeBytes": 48896604928
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-397B-A17B-GGUF/resolve/main/Q8_0/Qwen3.5-397B-A17B-Q8_0-00007-of-00010.gguf",
            "fileName": "Qwen3.5-397B-A17B-Q8_0-00007-of-00010.gguf",
            "sizeBytes": 48918889472
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-397B-A17B-GGUF/resolve/main/Q8_0/Qwen3.5-397B-A17B-Q8_0-00008-of-00010.gguf",
            "fileName": "Qwen3.5-397B-A17B-Q8_0-00008-of-00010.gguf",
            "sizeBytes": 48918889472
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-397B-A17B-GGUF/resolve/main/Q8_0/Qwen3.5-397B-A17B-Q8_0-00009-of-00010.gguf",
            "fileName": "Qwen3.5-397B-A17B-Q8_0-00009-of-00010.gguf",
            "sizeBytes": 48955296128
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-397B-A17B-GGUF/resolve/main/Q8_0/Qwen3.5-397B-A17B-Q8_0-00010-of-00010.gguf",
            "fileName": "Qwen3.5-397B-A17B-Q8_0-00010-of-00010.gguf",
            "sizeBytes": 30241843040
          }
        ]
      },
      {
        "id": "qwen3.5-397b-a17b:BF16",
        "quant": "BF16",
        "label": "16-Bit – Original, unquantisiert (groß und langsamer)",
        "sizeBytes": 792961318816,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-397B-A17B-GGUF/resolve/main/BF16/Qwen3.5-397B-A17B-BF16-00001-of-00017.gguf",
            "fileName": "Qwen3.5-397B-A17B-BF16-00001-of-00017.gguf",
            "sizeBytes": 47255584352
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-397B-A17B-GGUF/resolve/main/BF16/Qwen3.5-397B-A17B-BF16-00002-of-00017.gguf",
            "fileName": "Qwen3.5-397B-A17B-BF16-00002-of-00017.gguf",
            "sizeBytes": 47244641184
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-397B-A17B-GGUF/resolve/main/BF16/Qwen3.5-397B-A17B-BF16-00003-of-00017.gguf",
            "fileName": "Qwen3.5-397B-A17B-BF16-00003-of-00017.gguf",
            "sizeBytes": 47244641184
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-397B-A17B-GGUF/resolve/main/BF16/Qwen3.5-397B-A17B-BF16-00004-of-00017.gguf",
            "fileName": "Qwen3.5-397B-A17B-BF16-00004-of-00017.gguf",
            "sizeBytes": 47244641184
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-397B-A17B-GGUF/resolve/main/BF16/Qwen3.5-397B-A17B-BF16-00005-of-00017.gguf",
            "fileName": "Qwen3.5-397B-A17B-BF16-00005-of-00017.gguf",
            "sizeBytes": 47244641184
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-397B-A17B-GGUF/resolve/main/BF16/Qwen3.5-397B-A17B-BF16-00006-of-00017.gguf",
            "fileName": "Qwen3.5-397B-A17B-BF16-00006-of-00017.gguf",
            "sizeBytes": 47244641184
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-397B-A17B-GGUF/resolve/main/BF16/Qwen3.5-397B-A17B-BF16-00007-of-00017.gguf",
            "fileName": "Qwen3.5-397B-A17B-BF16-00007-of-00017.gguf",
            "sizeBytes": 47244641184
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-397B-A17B-GGUF/resolve/main/BF16/Qwen3.5-397B-A17B-BF16-00008-of-00017.gguf",
            "fileName": "Qwen3.5-397B-A17B-BF16-00008-of-00017.gguf",
            "sizeBytes": 47244641184
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-397B-A17B-GGUF/resolve/main/BF16/Qwen3.5-397B-A17B-BF16-00009-of-00017.gguf",
            "fileName": "Qwen3.5-397B-A17B-BF16-00009-of-00017.gguf",
            "sizeBytes": 47244641184
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-397B-A17B-GGUF/resolve/main/BF16/Qwen3.5-397B-A17B-BF16-00010-of-00017.gguf",
            "fileName": "Qwen3.5-397B-A17B-BF16-00010-of-00017.gguf",
            "sizeBytes": 47244641184
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-397B-A17B-GGUF/resolve/main/BF16/Qwen3.5-397B-A17B-BF16-00011-of-00017.gguf",
            "fileName": "Qwen3.5-397B-A17B-BF16-00011-of-00017.gguf",
            "sizeBytes": 47244641184
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-397B-A17B-GGUF/resolve/main/BF16/Qwen3.5-397B-A17B-BF16-00012-of-00017.gguf",
            "fileName": "Qwen3.5-397B-A17B-BF16-00012-of-00017.gguf",
            "sizeBytes": 47244641216
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-397B-A17B-GGUF/resolve/main/BF16/Qwen3.5-397B-A17B-BF16-00013-of-00017.gguf",
            "fileName": "Qwen3.5-397B-A17B-BF16-00013-of-00017.gguf",
            "sizeBytes": 47244641184
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-397B-A17B-GGUF/resolve/main/BF16/Qwen3.5-397B-A17B-BF16-00014-of-00017.gguf",
            "fileName": "Qwen3.5-397B-A17B-BF16-00014-of-00017.gguf",
            "sizeBytes": 47244641184
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-397B-A17B-GGUF/resolve/main/BF16/Qwen3.5-397B-A17B-BF16-00015-of-00017.gguf",
            "fileName": "Qwen3.5-397B-A17B-BF16-00015-of-00017.gguf",
            "sizeBytes": 47244641216
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-397B-A17B-GGUF/resolve/main/BF16/Qwen3.5-397B-A17B-BF16-00016-of-00017.gguf",
            "fileName": "Qwen3.5-397B-A17B-BF16-00016-of-00017.gguf",
            "sizeBytes": 47244641216
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3.5-397B-A17B-GGUF/resolve/main/BF16/Qwen3.5-397B-A17B-BF16-00017-of-00017.gguf",
            "fileName": "Qwen3.5-397B-A17B-BF16-00017-of-00017.gguf",
            "sizeBytes": 37036116608
          }
        ]
      }
    ]
  },
  {
    "id": "qwen3-coder-480b",
    "name": "Qwen3 Coder 480B A35B",
    "description": "Das größte offene Coding-Modell dieser Liste. Nur für sehr große Rechner.",
    "repo": "unsloth/Qwen3-Coder-480B-A35B-Instruct-GGUF",
    "sizeClass": "riesig",
    "totalParamsB": 480,
    "activeParamsB": 35,
    "tags": [
      "Code",
      "Agent",
      "Qualität",
      "MoE"
    ],
    "license": {
      "name": "Apache 2.0",
      "url": "https://huggingface.co/Qwen/Qwen3-Coder-480B-A35B-Instruct/blob/main/LICENSE",
      "commercial": true
    },
    "recommendedVariant": "qwen3-coder-480b:Q4_K_M",
    "variants": [
      {
        "id": "qwen3-coder-480b:UD-Q2_K_XL",
        "quant": "UD-Q2_K_XL",
        "label": "2-Bit (Unsloth Dynamic) – passt noch am ehesten, spürbar schwächer",
        "sizeBytes": 180294643936,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-480B-A35B-Instruct-GGUF/resolve/main/UD-Q2_K_XL/Qwen3-Coder-480B-A35B-Instruct-UD-Q2_K_XL-00001-of-00004.gguf",
            "fileName": "Qwen3-Coder-480B-A35B-Instruct-UD-Q2_K_XL-00001-of-00004.gguf",
            "sizeBytes": 49584600608
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-480B-A35B-Instruct-GGUF/resolve/main/UD-Q2_K_XL/Qwen3-Coder-480B-A35B-Instruct-UD-Q2_K_XL-00002-of-00004.gguf",
            "fileName": "Qwen3-Coder-480B-A35B-Instruct-UD-Q2_K_XL-00002-of-00004.gguf",
            "sizeBytes": 49008188576
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-480B-A35B-Instruct-GGUF/resolve/main/UD-Q2_K_XL/Qwen3-Coder-480B-A35B-Instruct-UD-Q2_K_XL-00003-of-00004.gguf",
            "fileName": "Qwen3-Coder-480B-A35B-Instruct-UD-Q2_K_XL-00003-of-00004.gguf",
            "sizeBytes": 49957975808
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-480B-A35B-Instruct-GGUF/resolve/main/UD-Q2_K_XL/Qwen3-Coder-480B-A35B-Instruct-UD-Q2_K_XL-00004-of-00004.gguf",
            "fileName": "Qwen3-Coder-480B-A35B-Instruct-UD-Q2_K_XL-00004-of-00004.gguf",
            "sizeBytes": 31743878944
          }
        ]
      },
      {
        "id": "qwen3-coder-480b:Q3_K_M",
        "quant": "Q3_K_M",
        "label": "3-Bit – klein, leichte Einbußen",
        "sizeBytes": 229248837984,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-480B-A35B-Instruct-GGUF/resolve/main/Q3_K_M/Qwen3-Coder-480B-A35B-Instruct-Q3_K_M-00001-of-00005.gguf",
            "fileName": "Qwen3-Coder-480B-A35B-Instruct-Q3_K_M-00001-of-00005.gguf",
            "sizeBytes": 49823479840
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-480B-A35B-Instruct-GGUF/resolve/main/Q3_K_M/Qwen3-Coder-480B-A35B-Instruct-Q3_K_M-00002-of-00005.gguf",
            "fileName": "Qwen3-Coder-480B-A35B-Instruct-Q3_K_M-00002-of-00005.gguf",
            "sizeBytes": 49039760192
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-480B-A35B-Instruct-GGUF/resolve/main/Q3_K_M/Qwen3-Coder-480B-A35B-Instruct-Q3_K_M-00003-of-00005.gguf",
            "fileName": "Qwen3-Coder-480B-A35B-Instruct-Q3_K_M-00003-of-00005.gguf",
            "sizeBytes": 49872003488
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-480B-A35B-Instruct-GGUF/resolve/main/Q3_K_M/Qwen3-Coder-480B-A35B-Instruct-Q3_K_M-00004-of-00005.gguf",
            "fileName": "Qwen3-Coder-480B-A35B-Instruct-Q3_K_M-00004-of-00005.gguf",
            "sizeBytes": 49039760192
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-480B-A35B-Instruct-GGUF/resolve/main/Q3_K_M/Qwen3-Coder-480B-A35B-Instruct-Q3_K_M-00005-of-00005.gguf",
            "fileName": "Qwen3-Coder-480B-A35B-Instruct-Q3_K_M-00005-of-00005.gguf",
            "sizeBytes": 31473834272
          }
        ]
      },
      {
        "id": "qwen3-coder-480b:Q4_K_M",
        "quant": "Q4_K_M",
        "label": "4-Bit – empfohlen: schnell, kaum Qualitätsverlust",
        "sizeBytes": 290058826208,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-480B-A35B-Instruct-GGUF/resolve/main/Q4_K_M/Qwen3-Coder-480B-A35B-Instruct-Q4_K_M-00001-of-00006.gguf",
            "fileName": "Qwen3-Coder-480B-A35B-Instruct-Q4_K_M-00001-of-00006.gguf",
            "sizeBytes": 49973553312
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-480B-A35B-Instruct-GGUF/resolve/main/Q4_K_M/Qwen3-Coder-480B-A35B-Instruct-Q4_K_M-00002-of-00006.gguf",
            "fileName": "Qwen3-Coder-480B-A35B-Instruct-Q4_K_M-00002-of-00006.gguf",
            "sizeBytes": 49768927168
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-480B-A35B-Instruct-GGUF/resolve/main/Q4_K_M/Qwen3-Coder-480B-A35B-Instruct-Q4_K_M-00003-of-00006.gguf",
            "fileName": "Qwen3-Coder-480B-A35B-Instruct-Q4_K_M-00003-of-00006.gguf",
            "sizeBytes": 48862488352
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-480B-A35B-Instruct-GGUF/resolve/main/Q4_K_M/Qwen3-Coder-480B-A35B-Instruct-Q4_K_M-00004-of-00006.gguf",
            "fileName": "Qwen3-Coder-480B-A35B-Instruct-Q4_K_M-00004-of-00006.gguf",
            "sizeBytes": 48952192064
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-480B-A35B-Instruct-GGUF/resolve/main/Q4_K_M/Qwen3-Coder-480B-A35B-Instruct-Q4_K_M-00005-of-00006.gguf",
            "fileName": "Qwen3-Coder-480B-A35B-Instruct-Q4_K_M-00005-of-00006.gguf",
            "sizeBytes": 49721298176
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-480B-A35B-Instruct-GGUF/resolve/main/Q4_K_M/Qwen3-Coder-480B-A35B-Instruct-Q4_K_M-00006-of-00006.gguf",
            "fileName": "Qwen3-Coder-480B-A35B-Instruct-Q4_K_M-00006-of-00006.gguf",
            "sizeBytes": 42780367136
          }
        ]
      },
      {
        "id": "qwen3-coder-480b:Q6_K",
        "quant": "Q6_K",
        "label": "6-Bit – sehr gute Qualität",
        "sizeBytes": 394079320928,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-480B-A35B-Instruct-GGUF/resolve/main/Q6_K/Qwen3-Coder-480B-A35B-Instruct-Q6_K-00001-of-00009.gguf",
            "fileName": "Qwen3-Coder-480B-A35B-Instruct-Q6_K-00001-of-00009.gguf",
            "sizeBytes": 48055312064
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-480B-A35B-Instruct-GGUF/resolve/main/Q6_K/Qwen3-Coder-480B-A35B-Instruct-Q6_K-00002-of-00009.gguf",
            "fileName": "Qwen3-Coder-480B-A35B-Instruct-Q6_K-00002-of-00009.gguf",
            "sizeBytes": 48586176448
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-480B-A35B-Instruct-GGUF/resolve/main/Q6_K/Qwen3-Coder-480B-A35B-Instruct-Q6_K-00003-of-00009.gguf",
            "fileName": "Qwen3-Coder-480B-A35B-Instruct-Q6_K-00003-of-00009.gguf",
            "sizeBytes": 48451965504
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-480B-A35B-Instruct-GGUF/resolve/main/Q6_K/Qwen3-Coder-480B-A35B-Instruct-Q6_K-00004-of-00009.gguf",
            "fileName": "Qwen3-Coder-480B-A35B-Instruct-Q6_K-00004-of-00009.gguf",
            "sizeBytes": 48582219616
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-480B-A35B-Instruct-GGUF/resolve/main/Q6_K/Qwen3-Coder-480B-A35B-Instruct-Q6_K-00005-of-00009.gguf",
            "fileName": "Qwen3-Coder-480B-A35B-Instruct-Q6_K-00005-of-00009.gguf",
            "sizeBytes": 48586176480
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-480B-A35B-Instruct-GGUF/resolve/main/Q6_K/Qwen3-Coder-480B-A35B-Instruct-Q6_K-00006-of-00009.gguf",
            "fileName": "Qwen3-Coder-480B-A35B-Instruct-Q6_K-00006-of-00009.gguf",
            "sizeBytes": 48451965504
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-480B-A35B-Instruct-GGUF/resolve/main/Q6_K/Qwen3-Coder-480B-A35B-Instruct-Q6_K-00007-of-00009.gguf",
            "fileName": "Qwen3-Coder-480B-A35B-Instruct-Q6_K-00007-of-00009.gguf",
            "sizeBytes": 48582219616
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-480B-A35B-Instruct-GGUF/resolve/main/Q6_K/Qwen3-Coder-480B-A35B-Instruct-Q6_K-00008-of-00009.gguf",
            "fileName": "Qwen3-Coder-480B-A35B-Instruct-Q6_K-00008-of-00009.gguf",
            "sizeBytes": 48586176480
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-480B-A35B-Instruct-GGUF/resolve/main/Q6_K/Qwen3-Coder-480B-A35B-Instruct-Q6_K-00009-of-00009.gguf",
            "fileName": "Qwen3-Coder-480B-A35B-Instruct-Q6_K-00009-of-00009.gguf",
            "sizeBytes": 6197109216
          }
        ]
      },
      {
        "id": "qwen3-coder-480b:Q8_0",
        "quant": "Q8_0",
        "label": "8-Bit – nahezu verlustfrei",
        "sizeBytes": 510351879264,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-480B-A35B-Instruct-GGUF/resolve/main/Q8_0/Qwen3-Coder-480B-A35B-Instruct-Q8_0-00001-of-00011.gguf",
            "fileName": "Qwen3-Coder-480B-A35B-Instruct-Q8_0-00001-of-00011.gguf",
            "sizeBytes": 48512115136
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-480B-A35B-Instruct-GGUF/resolve/main/Q8_0/Qwen3-Coder-480B-A35B-Instruct-Q8_0-00002-of-00011.gguf",
            "fileName": "Qwen3-Coder-480B-A35B-Instruct-Q8_0-00002-of-00011.gguf",
            "sizeBytes": 49196345856
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-480B-A35B-Instruct-GGUF/resolve/main/Q8_0/Qwen3-Coder-480B-A35B-Instruct-Q8_0-00003-of-00011.gguf",
            "fileName": "Qwen3-Coder-480B-A35B-Instruct-Q8_0-00003-of-00011.gguf",
            "sizeBytes": 49196345920
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-480B-A35B-Instruct-GGUF/resolve/main/Q8_0/Qwen3-Coder-480B-A35B-Instruct-Q8_0-00004-of-00011.gguf",
            "fileName": "Qwen3-Coder-480B-A35B-Instruct-Q8_0-00004-of-00011.gguf",
            "sizeBytes": 49196345920
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-480B-A35B-Instruct-GGUF/resolve/main/Q8_0/Qwen3-Coder-480B-A35B-Instruct-Q8_0-00005-of-00011.gguf",
            "fileName": "Qwen3-Coder-480B-A35B-Instruct-Q8_0-00005-of-00011.gguf",
            "sizeBytes": 49196345920
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-480B-A35B-Instruct-GGUF/resolve/main/Q8_0/Qwen3-Coder-480B-A35B-Instruct-Q8_0-00006-of-00011.gguf",
            "fileName": "Qwen3-Coder-480B-A35B-Instruct-Q8_0-00006-of-00011.gguf",
            "sizeBytes": 49196345920
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-480B-A35B-Instruct-GGUF/resolve/main/Q8_0/Qwen3-Coder-480B-A35B-Instruct-Q8_0-00007-of-00011.gguf",
            "fileName": "Qwen3-Coder-480B-A35B-Instruct-Q8_0-00007-of-00011.gguf",
            "sizeBytes": 49196345920
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-480B-A35B-Instruct-GGUF/resolve/main/Q8_0/Qwen3-Coder-480B-A35B-Instruct-Q8_0-00008-of-00011.gguf",
            "fileName": "Qwen3-Coder-480B-A35B-Instruct-Q8_0-00008-of-00011.gguf",
            "sizeBytes": 49196345920
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-480B-A35B-Instruct-GGUF/resolve/main/Q8_0/Qwen3-Coder-480B-A35B-Instruct-Q8_0-00009-of-00011.gguf",
            "fileName": "Qwen3-Coder-480B-A35B-Instruct-Q8_0-00009-of-00011.gguf",
            "sizeBytes": 49196345920
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-480B-A35B-Instruct-GGUF/resolve/main/Q8_0/Qwen3-Coder-480B-A35B-Instruct-Q8_0-00010-of-00011.gguf",
            "fileName": "Qwen3-Coder-480B-A35B-Instruct-Q8_0-00010-of-00011.gguf",
            "sizeBytes": 49196345920
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-480B-A35B-Instruct-GGUF/resolve/main/Q8_0/Qwen3-Coder-480B-A35B-Instruct-Q8_0-00011-of-00011.gguf",
            "fileName": "Qwen3-Coder-480B-A35B-Instruct-Q8_0-00011-of-00011.gguf",
            "sizeBytes": 19072650912
          }
        ]
      },
      {
        "id": "qwen3-coder-480b:BF16",
        "quant": "BF16",
        "label": "16-Bit – Original, unquantisiert (groß und langsamer)",
        "sizeBytes": 960439201856,
        "files": [
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-480B-A35B-Instruct-GGUF/resolve/main/BF16/Qwen3-Coder-480B-A35B-Instruct-BF16-00001-of-00021.gguf",
            "fileName": "Qwen3-Coder-480B-A35B-Instruct-BF16-00001-of-00021.gguf",
            "sizeBytes": 48492007776
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-480B-A35B-Instruct-GGUF/resolve/main/BF16/Qwen3-Coder-480B-A35B-Instruct-BF16-00002-of-00021.gguf",
            "fileName": "Qwen3-Coder-480B-A35B-Instruct-BF16-00002-of-00021.gguf",
            "sizeBytes": 46291899712
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-480B-A35B-Instruct-GGUF/resolve/main/BF16/Qwen3-Coder-480B-A35B-Instruct-BF16-00003-of-00021.gguf",
            "fileName": "Qwen3-Coder-480B-A35B-Instruct-BF16-00003-of-00021.gguf",
            "sizeBytes": 46619056800
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-480B-A35B-Instruct-GGUF/resolve/main/BF16/Qwen3-Coder-480B-A35B-Instruct-BF16-00004-of-00021.gguf",
            "fileName": "Qwen3-Coder-480B-A35B-Instruct-BF16-00004-of-00021.gguf",
            "sizeBytes": 45964742624
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-480B-A35B-Instruct-GGUF/resolve/main/BF16/Qwen3-Coder-480B-A35B-Instruct-BF16-00005-of-00021.gguf",
            "fileName": "Qwen3-Coder-480B-A35B-Instruct-BF16-00005-of-00021.gguf",
            "sizeBytes": 46291899744
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-480B-A35B-Instruct-GGUF/resolve/main/BF16/Qwen3-Coder-480B-A35B-Instruct-BF16-00006-of-00021.gguf",
            "fileName": "Qwen3-Coder-480B-A35B-Instruct-BF16-00006-of-00021.gguf",
            "sizeBytes": 46291899744
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-480B-A35B-Instruct-GGUF/resolve/main/BF16/Qwen3-Coder-480B-A35B-Instruct-BF16-00007-of-00021.gguf",
            "fileName": "Qwen3-Coder-480B-A35B-Instruct-BF16-00007-of-00021.gguf",
            "sizeBytes": 46291899744
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-480B-A35B-Instruct-GGUF/resolve/main/BF16/Qwen3-Coder-480B-A35B-Instruct-BF16-00008-of-00021.gguf",
            "fileName": "Qwen3-Coder-480B-A35B-Instruct-BF16-00008-of-00021.gguf",
            "sizeBytes": 46291899744
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-480B-A35B-Instruct-GGUF/resolve/main/BF16/Qwen3-Coder-480B-A35B-Instruct-BF16-00009-of-00021.gguf",
            "fileName": "Qwen3-Coder-480B-A35B-Instruct-BF16-00009-of-00021.gguf",
            "sizeBytes": 46291899744
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-480B-A35B-Instruct-GGUF/resolve/main/BF16/Qwen3-Coder-480B-A35B-Instruct-BF16-00010-of-00021.gguf",
            "fileName": "Qwen3-Coder-480B-A35B-Instruct-BF16-00010-of-00021.gguf",
            "sizeBytes": 46291899744
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-480B-A35B-Instruct-GGUF/resolve/main/BF16/Qwen3-Coder-480B-A35B-Instruct-BF16-00011-of-00021.gguf",
            "fileName": "Qwen3-Coder-480B-A35B-Instruct-BF16-00011-of-00021.gguf",
            "sizeBytes": 46291899744
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-480B-A35B-Instruct-GGUF/resolve/main/BF16/Qwen3-Coder-480B-A35B-Instruct-BF16-00012-of-00021.gguf",
            "fileName": "Qwen3-Coder-480B-A35B-Instruct-BF16-00012-of-00021.gguf",
            "sizeBytes": 46291899744
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-480B-A35B-Instruct-GGUF/resolve/main/BF16/Qwen3-Coder-480B-A35B-Instruct-BF16-00013-of-00021.gguf",
            "fileName": "Qwen3-Coder-480B-A35B-Instruct-BF16-00013-of-00021.gguf",
            "sizeBytes": 46291899744
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-480B-A35B-Instruct-GGUF/resolve/main/BF16/Qwen3-Coder-480B-A35B-Instruct-BF16-00014-of-00021.gguf",
            "fileName": "Qwen3-Coder-480B-A35B-Instruct-BF16-00014-of-00021.gguf",
            "sizeBytes": 46291899744
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-480B-A35B-Instruct-GGUF/resolve/main/BF16/Qwen3-Coder-480B-A35B-Instruct-BF16-00015-of-00021.gguf",
            "fileName": "Qwen3-Coder-480B-A35B-Instruct-BF16-00015-of-00021.gguf",
            "sizeBytes": 46291899744
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-480B-A35B-Instruct-GGUF/resolve/main/BF16/Qwen3-Coder-480B-A35B-Instruct-BF16-00016-of-00021.gguf",
            "fileName": "Qwen3-Coder-480B-A35B-Instruct-BF16-00016-of-00021.gguf",
            "sizeBytes": 46291899744
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-480B-A35B-Instruct-GGUF/resolve/main/BF16/Qwen3-Coder-480B-A35B-Instruct-BF16-00017-of-00021.gguf",
            "fileName": "Qwen3-Coder-480B-A35B-Instruct-BF16-00017-of-00021.gguf",
            "sizeBytes": 46291899744
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-480B-A35B-Instruct-GGUF/resolve/main/BF16/Qwen3-Coder-480B-A35B-Instruct-BF16-00018-of-00021.gguf",
            "fileName": "Qwen3-Coder-480B-A35B-Instruct-BF16-00018-of-00021.gguf",
            "sizeBytes": 46291899744
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-480B-A35B-Instruct-GGUF/resolve/main/BF16/Qwen3-Coder-480B-A35B-Instruct-BF16-00019-of-00021.gguf",
            "fileName": "Qwen3-Coder-480B-A35B-Instruct-BF16-00019-of-00021.gguf",
            "sizeBytes": 46291899744
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-480B-A35B-Instruct-GGUF/resolve/main/BF16/Qwen3-Coder-480B-A35B-Instruct-BF16-00020-of-00021.gguf",
            "fileName": "Qwen3-Coder-480B-A35B-Instruct-BF16-00020-of-00021.gguf",
            "sizeBytes": 46291899744
          },
          {
            "url": "https://huggingface.co/unsloth/Qwen3-Coder-480B-A35B-Instruct-GGUF/resolve/main/BF16/Qwen3-Coder-480B-A35B-Instruct-BF16-00021-of-00021.gguf",
            "fileName": "Qwen3-Coder-480B-A35B-Instruct-BF16-00021-of-00021.gguf",
            "sizeBytes": 32401099040
          }
        ]
      }
    ]
  }
]
