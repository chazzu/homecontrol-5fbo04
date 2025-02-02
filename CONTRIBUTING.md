# Contributing to Smart Home Dashboard

Welcome to the Smart Home Dashboard project! We're excited that you're interested in contributing. This document provides guidelines for contributing to the project in a way that is efficient and maintains our high standards for code quality.

## Code of Conduct

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before contributing. We are committed to providing a welcoming and inclusive environment for all contributors.

## Development Setup

### Prerequisites

- Node.js 16.0+
- npm/yarn (latest version)
- Git (latest version)
- Modern evergreen browser
- VS Code (recommended)
- Home Assistant test instance (optional)

### Environment Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/smart-home-dashboard.git
cd smart-home-dashboard
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Configure environment:
   - Copy `.env.example` to `.env`
   - Update environment variables as needed
   - Configure Home Assistant connection settings

4. Start development server:
```bash
npm run dev
# or
yarn dev
```

## Development Workflow

### Branching Strategy

- Create branches from `main` using the following prefixes:
  - `feature/` - New features
  - `bugfix/` - Bug fixes
  - `hotfix/` - Critical fixes for production
  - `docs/` - Documentation updates
  - `refactor/` - Code refactoring

Example: `feature/floor-plan-zoom`

### Commit Guidelines

Follow the Conventional Commits specification:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Types:
- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, semicolons, etc)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

Example: `feat(floor-plan): add zoom controls for SVG viewer`

### CI/CD Pipeline

All contributions must pass through our automated pipeline:

1. **Build Verification**
   - TypeScript compilation
   - Dependency audit
   - Linting checks

2. **Testing**
   - Unit tests
   - Integration tests
   - Coverage requirements (80% minimum)

3. **Code Quality**
   - ESLint validation
   - Prettier formatting
   - SonarQube analysis

4. **Deployment Stages**
   - Development (automatic)
   - Staging (manual approval)
   - Production (protected branch)

## Coding Standards

### TypeScript Guidelines

- Enable strict mode in `tsconfig.json`
- Use interfaces for object shapes
- Prefer type inference where possible
- Document complex types
- Use enums for fixed values

```typescript
interface EntityConfig {
  id: string;
  type: EntityType;
  position: Position;
  settings?: Record<string, unknown>;
}
```

### React Best Practices

- Use functional components
- Implement proper memo usage
- Follow hooks rules
- Maintain component pure functions
- Implement error boundaries

```typescript
const EntityIcon: React.FC<EntityIconProps> = React.memo(({ entity, position }) => {
  // Component implementation
});
```

### Testing Requirements

- Jest for unit testing
- React Testing Library for component tests
- Cypress for E2E testing
- 80% minimum coverage
- Test real user scenarios

```typescript
describe('EntityIcon', () => {
  it('should render with correct position', () => {
    // Test implementation
  });
});
```

## Plugin Development

### Plugin Architecture

Plugins must implement the standard interface:

```typescript
interface Plugin {
  id: string;
  version: string;
  initialize(): Promise<void>;
  cleanup(): Promise<void>;
}
```

### Security Guidelines

- Validate all inputs
- Use secure communication
- Implement proper authentication
- Follow OWASP guidelines
- Handle data securely

### Performance Requirements

- Load time < 500ms
- Memory usage < 50MB
- 60fps rendering
- Efficient resource cleanup

## Submitting Changes

1. Create a new branch
2. Make your changes
3. Add or update tests
4. Update documentation
5. Submit a pull request using the [PR template](.github/PULL_REQUEST_TEMPLATE.md)

## Bug Reports

Submit bug reports using the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md).

## Questions and Support

- Use GitHub Discussions for questions
- Check existing issues before creating new ones
- Provide complete information when seeking help

Thank you for contributing to Smart Home Dashboard! 🏠✨