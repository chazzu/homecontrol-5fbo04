# Smart Home Dashboard - Backend Service

A robust and scalable backend service for the Smart Home Dashboard, providing real-time communication with Home Assistant, data management, and API endpoints for frontend integration.

## Table of Contents
- [Introduction](#introduction)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Development](#development)
- [Testing](#testing)
- [API Documentation](#api-documentation)
- [Project Structure](#project-structure)
- [Contributing](#contributing)

## Introduction

The Smart Home Dashboard backend service provides the core infrastructure for real-time device control and state management. Built with TypeScript and Node.js, it implements a WebSocket-based communication layer with Home Assistant, secure data storage, and a plugin system for extensibility.

### Key Features

- **WebSocket Integration**: Real-time bidirectional communication with Home Assistant
- **Data Management**: MongoDB-based storage for floor plans and configurations
- **Plugin System**: Dynamic loading of custom extensions
- **Security**: Comprehensive authentication and encryption

## Prerequisites

- Node.js 16+
- npm 8+
- MongoDB 5+
- Home Assistant instance
- Git

### Development Tools
- Visual Studio Code (recommended)
- ESLint
- Prettier
- TypeScript 5.0+

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/smart-home-dashboard.git
cd smart-home-dashboard/src/backend
```

2. Set up environment configuration:
```bash
cp .env.example .env
```

3. Install dependencies:
```bash
npm install
```

4. Start development server:
```bash
npm run dev
```

## Configuration

### Environment Variables

Create a `.env` file based on `.env.example` with the following required variables:

```env
# Home Assistant Configuration
HA_URL=http://your-ha-instance:8123
HA_TOKEN=your_long_lived_access_token

# Server Configuration
PORT=3000
NODE_ENV=development

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/smart-home-dashboard

# Security
JWT_SECRET=your_jwt_secret
CORS_ORIGIN=http://localhost:5173
```

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build production bundle
- `npm test` - Run test suite
- `npm run lint` - Run code quality checks

## Development

### Project Structure

```
src/
├── api/            # API routes and controllers
├── core/           # Core business logic
├── database/       # MongoDB models and repositories
├── types/          # TypeScript definitions
├── config/         # Configuration files
└── tests/          # Test suites
```

### Coding Standards

- Use TypeScript strict mode
- Follow ESLint and Prettier configurations
- Write comprehensive unit tests
- Document all public APIs
- Use async/await for asynchronous operations

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suite
npm test -- api.test.ts

# Run with coverage
npm test -- --coverage
```

### Test Structure

- `tests/unit/` - Unit tests for individual components
- `tests/integration/` - Integration tests for API endpoints
- `tests/e2e/` - End-to-end testing scenarios

## API Documentation

### WebSocket Events

```typescript
// Authentication
client.emit('auth', { access_token: string });
server.emit('auth_success', { status: 'ok' });

// Device State
client.emit('subscribe_states', { entity_id: string });
server.emit('state_changed', { entity_id: string, state: any });

// Commands
client.emit('call_service', {
  domain: string,
  service: string,
  target: { entity_id: string }
});
```

### REST Endpoints

```typescript
// Floor Plans
GET    /api/floorplans
POST   /api/floorplans
PUT    /api/floorplans/:id
DELETE /api/floorplans/:id

// Device Configuration
GET    /api/devices
POST   /api/devices
PUT    /api/devices/:id
DELETE /api/devices/:id

// Plugin Management
GET    /api/plugins
POST   /api/plugins
DELETE /api/plugins/:id
```

## Project Structure

```
backend/
├── src/
│   ├── api/              # API implementation
│   │   ├── controllers/  # Request handlers
│   │   ├── middleware/   # Custom middleware
│   │   └── routes/       # Route definitions
│   ├── core/             # Core business logic
│   │   ├── ha/          # Home Assistant integration
│   │   ├── plugins/     # Plugin system
│   │   └── services/    # Business services
│   ├── database/         # Data access layer
│   │   ├── models/      # MongoDB schemas
│   │   └── repositories/# Data repositories
│   ├── types/           # TypeScript types
│   └── config/          # Configuration
├── tests/               # Test suites
├── package.json         # Dependencies
├── tsconfig.json        # TypeScript config
└── .env.example         # Environment template
```

## Contributing

### Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Review Guidelines

- Ensure all tests pass
- Maintain code coverage above 80%
- Follow existing code style
- Include documentation updates
- Add relevant test cases

### Development Workflow

1. Pick an issue or create one
2. Discuss implementation approach
3. Write tests first (TDD)
4. Implement the feature
5. Update documentation
6. Submit pull request

For detailed contribution guidelines, please see CONTRIBUTING.md.

## License

This project is licensed under the MIT License - see the LICENSE file for details.