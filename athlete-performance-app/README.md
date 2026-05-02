# 🏃‍♂️ Athlete Performance App

## Quick Start

1. **Start the development environment:**
   ```bash
   docker-compose up app
   ```

2. **Access the app:**
   - Web: http://localhost:19000
   - Expo DevTools: http://localhost:19002

3. **Start with backend (when ready):**
   ```bash
   docker-compose --profile backend up
   ```

## Development Ports (Isolated from work)
- **App**: 19000-19002 
- **Database**: 5433 (not 5432)
- **Redis**: 6380 (not 6379)
- **Backend**: 8080

## Features Planned
- ✅ Isolated Docker environment
- ✅ React Native with Expo
- ⏳ User authentication
- ⏳ Video upload/playback
- ⏳ AI coaching integration
- ⏳ Performance tracking
- ⏳ Social features

## Commands
- `docker-compose up app` - Start just the app
- `docker-compose up` - Start app + database
- `docker-compose --profile backend up` - Start everything
- `docker-compose down` - Stop all services
