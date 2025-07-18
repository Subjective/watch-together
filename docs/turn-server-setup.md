# Cloudflare TURN Server Setup

This document describes how to set up and configure Cloudflare TURN servers for enhanced WebRTC connectivity in the Watch Together extension.

## Overview

Cloudflare TURN servers provide relay functionality for WebRTC connections, ensuring connectivity even in restrictive network environments. This implementation includes:

- Dynamic credential generation
- Automatic refresh and caching
- Fallback to STUN-only mode
- Comprehensive error handling

## Prerequisites

1. **Cloudflare Account**: You need a Cloudflare account with access to the TURN service
2. **TURN Service Key**: Create a TURN service key in the Cloudflare dashboard
3. **API Token**: Generate an API token with permissions to access the TURN service

## Backend Configuration

### 1. Environment Variables

Add the following environment variables to your Cloudflare Worker:

```bash
# Required - Set these via wrangler secrets
TURN_KEY_ID="your-turn-key-id"
TURN_API_TOKEN="your-turn-api-token"

# Optional - Set these via wrangler.toml vars
TURN_API_ENDPOINT="https://rtc.live.cloudflare.com/v1/turn"
TURN_CREDENTIAL_TTL="86400"  # 24 hours
TURN_REFRESH_THRESHOLD="3600"  # 1 hour
```

### 2. Set Secrets (Production)

```bash
# Set secrets via wrangler CLI
npx wrangler secret put TURN_KEY_ID --env production
npx wrangler secret put TURN_API_TOKEN --env production
```

### 3. Development Setup

For development, you can set environment variables in your `wrangler.toml`:

```toml
[env.development.vars]
TURN_API_ENDPOINT = "https://rtc.live.cloudflare.com/v1/turn"
TURN_CREDENTIAL_TTL = "86400"
TURN_REFRESH_THRESHOLD = "3600"
```

## Frontend Configuration

### 1. Backend URL Configuration

The WebRTC manager needs to know the backend URL. Update the `getBackendUrl()` method in the `OffscreenWebRTCManager`:

```typescript
private getBackendUrl(): string {
  // Update this to match your deployed worker URL
  return "https://your-worker-name.your-subdomain.workers.dev";
}
```

### 2. Automatic Initialization

The TURN credentials are automatically initialized when the WebRTC manager is created. The system will:

1. Attempt to fetch TURN credentials from the backend
2. Configure ICE servers with Cloudflare TURN servers
3. Fall back to STUN-only mode if TURN is unavailable

## API Endpoints

### POST /api/turn/credentials

Generates new TURN server credentials.

**Request Body:**

```json
{
  "ttl": 86400
}
```

**Response (Success):**

```json
{
  "iceServers": [
    {
      "urls": ["stun:stun.cloudflare.com:3478"]
    },
    {
      "urls": ["turn:turn.cloudflare.com:3478"],
      "username": "1234567890:username",
      "credential": "credential-hash"
    }
  ]
}
```

**Response (Error):**

```json
{
  "error": "Error message",
  "fallback": true
}
```

## Configuration Options

### TURN Service Configuration

| Option             | Default                 | Description                      |
| ------------------ | ----------------------- | -------------------------------- |
| `apiEndpoint`      | `/api/turn/credentials` | Backend endpoint for credentials |
| `credentialTtl`    | `86400`                 | Credential lifetime in seconds   |
| `refreshThreshold` | `3600`                  | Refresh when N seconds remain    |
| `maxRetries`       | `3`                     | Maximum retry attempts           |
| `retryDelay`       | `1000`                  | Base retry delay in milliseconds |

### ICE Server Strategy

The system uses a dual-strategy approach:

1. **Primary**: Cloudflare TURN servers with credentials
2. **Fallback**: Google STUN servers for basic connectivity

## Error Handling

### Fallback Scenarios

The system automatically falls back to STUN-only mode in these cases:

1. **Service Not Configured**: Missing environment variables
2. **Network Errors**: Connection timeouts or failures
3. **API Rate Limits**: Temporary service unavailability
4. **Invalid Credentials**: Expired or invalid API tokens

### Error Responses

All API errors include a `fallback` flag indicating whether the client should fall back to STUN-only mode:

```json
{
  "error": "Rate limit exceeded",
  "fallback": true
}
```

## Testing

### Unit Tests

Run the TURN service tests:

```bash
# Backend tests
pnpm run test --filter=backend

# Frontend tests
pnpm run test --filter=extension
```

### Integration Tests

Test the complete TURN credential flow:

```bash
# Integration tests
pnpm run test:integration
```

### Manual Testing

1. **Check Service Status**: Verify the backend health endpoint
2. **Test Credentials**: Make a direct API call to the credentials endpoint
3. **WebRTC Connection**: Test peer connection establishment

## Monitoring

### Logging

The system provides comprehensive logging for debugging:

```
[TURN Credentials] Fetching credentials (attempt 1/3)
[TURN Credentials] Successfully fetched credentials, expires at: 2025-07-19T04:16:12.418Z
[TURN Credentials] Scheduling refresh in 82800000ms
```

### Metrics

Monitor these key metrics:

1. **Credential Generation Success Rate**
2. **Average Response Time**
3. **Fallback Frequency**
4. **Connection Success Rate**

## Troubleshooting

### Common Issues

1. **"TURN service not configured"**
   - Verify environment variables are set
   - Check API token permissions

2. **"Rate limit exceeded"**
   - Monitor API usage
   - Implement exponential backoff

3. **"Invalid response format"**
   - Check API endpoint URL
   - Verify response structure

### Debug Mode

Enable debug logging by setting the log level:

```typescript
// Temporary debug logging
console.log("[TURN Debug] Configuration:", config);
```

## Security Considerations

1. **API Token Security**: Never expose API tokens in client-side code
2. **Credential Lifetime**: Use short TTLs for better security
3. **Rate Limiting**: Implement proper rate limiting on the backend
4. **Error Handling**: Don't expose sensitive information in error messages

## Performance Optimization

1. **Credential Caching**: Cache credentials to reduce API calls
2. **Automatic Refresh**: Refresh before expiration to avoid interruptions
3. **Connection Reuse**: Reuse WebRTC connections when possible
4. **Fallback Strategy**: Quick fallback to STUN-only for better UX

## Migration Guide

### From STUN-Only

1. Deploy the updated backend with TURN support
2. Update frontend WebRTC manager
3. Configure environment variables
4. Test connectivity improvements

### Rollback Plan

1. Set `TURN_SERVICE_ENABLED=false` in environment
2. Remove TURN-related environment variables
3. System automatically falls back to STUN-only mode
