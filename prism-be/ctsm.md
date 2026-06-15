{
  "openapi": "3.1.0",
  "info": {
    "title": "CDTSM Inference Host",
    "version": "0.1.0"
  },
  "paths": {
    "/": {
      "get": {
        "summary": "Root",
        "operationId": "root__get",
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "additionalProperties": true,
                  "type": "object",
                  "title": "Response Root  Get"
                }
              }
            }
          }
        }
      }
    },
    "/health": {
      "get": {
        "summary": "Health",
        "operationId": "health_health_get",
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "additionalProperties": true,
                  "type": "object",
                  "title": "Response Health Health Get"
                }
              }
            }
          }
        }
      }
    },
    "/ready": {
      "get": {
        "summary": "Ready",
        "operationId": "ready_ready_get",
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {

                }
              }
            }
          }
        }
      }
    },
    "/cdtsm/v1/ai/infer": {
      "post": {
        "summary": "Infer",
        "operationId": "infer_cdtsm_v1_ai_infer_post",
        "security": [
          {
            "HTTPBearer": []
          }
        ],
        "parameters": [
          {
            "name": "horizon",
            "in": "query",
            "required": false,
            "schema": {
              "anyOf": [
                {
                  "type": "integer",
                  "minimum": 1
                },
                {
                  "type": "null"
                }
              ],
              "title": "Horizon"
            }
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/InferRequestBody"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/InferSuccessResponse"
                }
              }
            }
          },
          "400": {
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/InferErrorResponse"
                }
              }
            },
            "description": "Bad Request"
          },
          "401": {
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/InferErrorResponse"
                }
              }
            },
            "description": "Unauthorized"
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      }
    }
  },
  "components": {
    "schemas": {
      "ErrorDetail": {
        "properties": {
          "code": {
            "type": "string",
            "title": "Code"
          },
          "message": {
            "type": "string",
            "title": "Message"
          },
          "details": {
            "additionalProperties": true,
            "type": "object",
            "title": "Details"
          }
        },
        "type": "object",
        "required": [
          "code",
          "message"
        ],
        "title": "ErrorDetail"
      },
      "HTTPValidationError": {
        "properties": {
          "detail": {
            "items": {
              "$ref": "#/components/schemas/ValidationError"
            },
            "type": "array",
            "title": "Detail"
          }
        },
        "type": "object",
        "title": "HTTPValidationError"
      },
      "InferErrorResponse": {
        "properties": {
          "request_id": {
            "type": "string",
            "title": "Request Id"
          },
          "error": {
            "$ref": "#/components/schemas/ErrorDetail"
          }
        },
        "type": "object",
        "required": [
          "request_id",
          "error"
        ],
        "title": "InferErrorResponse"
      },
      "InferMetadata": {
        "properties": {
          "quantiles": {
            "items": {
              "type": "string"
            },
            "type": "array",
            "title": "Quantiles",
            "description": "Requested outputs: mean and/or p10, p50, …"
          }
        },
        "type": "object",
        "title": "InferMetadata"
      },
      "InferRequestBody": {
        "properties": {
          "payload": {
            "items": {
              "$ref": "#/components/schemas/SeriesPayload"
            },
            "type": "array",
            "title": "Payload"
          },
          "model": {
            "type": "string",
            "const": "CDTSM",
            "title": "Model",
            "default": "CDTSM"
          },
          "metadata": {
            "$ref": "#/components/schemas/InferMetadata"
          }
        },
        "type": "object",
        "required": [
          "payload"
        ],
        "title": "InferRequestBody"
      },
      "InferSuccessResponse": {
        "properties": {
          "request_id": {
            "type": "string",
            "title": "Request Id"
          },
          "model": {
            "type": "string",
            "title": "Model"
          },
          "horizon": {
            "type": "integer",
            "title": "Horizon"
          },
          "predictions": {
            "items": {
              "$ref": "#/components/schemas/PredictionItem"
            },
            "type": "array",
            "title": "Predictions"
          }
        },
        "type": "object",
        "required": [
          "request_id",
          "model",
          "horizon",
          "predictions"
        ],
        "title": "InferSuccessResponse"
      },
      "PredictionItem": {
        "properties": {
          "mean": {
            "items": {
              "anyOf": [
                {
                  "type": "number"
                },
                {
                  "type": "null"
                }
              ]
            },
            "type": "array",
            "title": "Mean"
          },
          "quantiles": {
            "additionalProperties": {
              "items": {
                "anyOf": [
                  {
                    "type": "number"
                  },
                  {
                    "type": "null"
                  }
                ]
              },
              "type": "array"
            },
            "type": "object",
            "title": "Quantiles"
          }
        },
        "type": "object",
        "required": [
          "mean",
          "quantiles"
        ],
        "title": "PredictionItem"
      },
      "SeriesPayload": {
        "properties": {
          "coarse_ctx": {
            "items": {
              "type": "number"
            },
            "type": "array",
            "minItems": 1,
            "title": "Coarse Ctx"
          },
          "fine_ctx": {
            "items": {
              "type": "number"
            },
            "type": "array",
            "minItems": 1,
            "title": "Fine Ctx"
          }
        },
        "type": "object",
        "required": [
          "coarse_ctx",
          "fine_ctx"
        ],
        "title": "SeriesPayload"
      },
      "ValidationError": {
        "properties": {
          "loc": {
            "items": {
              "anyOf": [
                {
                  "type": "string"
                },
                {
                  "type": "integer"
                }
              ]
            },
            "type": "array",
            "title": "Location"
          },
          "msg": {
            "type": "string",
            "title": "Message"
          },
          "type": {
            "type": "string",
            "title": "Error Type"
          },
          "input": {
            "title": "Input"
          },
          "ctx": {
            "type": "object",
            "title": "Context"
          }
        },
        "type": "object",
        "required": [
          "loc",
          "msg",
          "type"
        ],
        "title": "ValidationError"
      }
    },
    "securitySchemes": {
      "HTTPBearer": {
        "type": "http",
        "description": "Paste the value of CDTSM_AUTH_TOKEN (no 'Bearer ' prefix).",
        "scheme": "bearer",
        "bearerFormat": "CDTSM_AUTH_TOKEN"
      }
    }
  }
}