# Task Management Microservices Application

This project demonstrates a microservices architecture for a task management system with:
- User Service (REST) for user management, teams, and authentication
- Task Service (GraphQL) for tasks with real-time updates via subscriptions
- API Gateway with JWT-based authentication
- Next.js frontend application

## Architecture

```
Frontend (Next.js) → API Gateway (JWT Auth) → User Service (REST)
                                          → Task Service (GraphQL)
```

## Security

This application implements JWT-based authentication:
- **User Service** generates JWT tokens signed with RSA private key
- **API Gateway** verifies JWT tokens using RSA public key from User Service
- Protected routes require valid JWT token in Authorization header
- Public routes: `/api/auth/login`, `/api/auth/register`

## Services

### 1. User Service (Port 3001)
- Express.js REST API server
- User account management and teams
- JWT-based authentication with RSA keys (RS256 algorithm)
- Password hashing with bcrypt
- Endpoints:
  - `POST /api/auth/register` - Register new user (public)
  - `POST /api/auth/login` - Login user (public)
  - `GET /api/auth/me` - Get current user (protected)
  - `GET /api/auth/public-key` - Get public key for JWT verification
  - `GET /api/users` - List all users (protected)
  - `POST /api/users` - Create user (protected)
  - `GET /api/users/:id` - Get user by ID (protected)
  - `PUT /api/users/:id` - Update user (protected)
  - `DELETE /api/users/:id` - Delete user (protected)
  - `GET /api/teams` - List all teams (protected)
  - `POST /api/teams` - Create team (protected)
  - `GET /api/teams/:id` - Get team by ID (protected)
  - `PUT /api/teams/:id` - Update team (protected)
  - `DELETE /api/teams/:id` - Delete team (protected)
  - `POST /api/teams/:id/members` - Add member to team (protected)
  - `DELETE /api/teams/:id/members/:userId` - Remove member from team (protected)

### 2. Task Service (Port 4000)
- Apollo Server with GraphQL
- Task management with CRUD operations
- Real-time task updates via GraphQL subscriptions
- Tasks are linked to users and teams
- Endpoint: `/graphql` (protected)

**GraphQL Schema:**
```graphql
type Task {
  id: ID!
  title: String!
  description: String
  status: TaskStatus!  # todo, in_progress, completed, cancelled
  priority: TaskPriority!  # low, medium, high, urgent
  assignedTo: String  # User ID
  teamId: String
  createdBy: String!
  createdAt: String!
  updatedAt: String!
}

# Queries
tasks: [Task!]!
task(id: ID!): Task
tasksByUser(userId: String!): [Task!]!
tasksByTeam(teamId: String!): [Task!]!
tasksByStatus(status: TaskStatus!): [Task!]!

# Mutations
createTask(...): Task!
updateTask(id: ID!, ...): Task!
deleteTask(id: ID!): Boolean!

# Subscriptions (Real-time updates)
taskAdded: Task!
taskUpdated: Task!
taskDeleted: ID!
```

### 3. API Gateway (Port 3000)
- Routes requests to appropriate services
- JWT token verification using public key from User Service
- Rate limiting and CORS handling
- Forwards user information to downstream services via headers
- Public routes: `/api/auth/login`, `/api/auth/register`, `/api/auth/public-key`
- Protected routes: `/api/users/*`, `/api/teams/*`, `/api/auth/me`, `/graphql`

### 4. Frontend App (Port 3002)
- Next.js with TypeScript
- Apollo Client for GraphQL
- Axios for REST API calls
- JWT token management
- Tailwind CSS for styling

## Quick Start

### Using Docker (Recommended)

**Windows Users:**
Simply double-click `start.bat` and choose an option from the menu!

**Or use command line:**

1. **Development mode (with hot-reload):**
   ```bash
   npm run dev
   # or
   docker compose -f docker-compose.dev.yml up --build
   ```

2. **Production mode:**
   ```bash
   npm start
   # or
   docker compose up --build
   ```

3. **Stop all services:**
   ```bash
   npm run stop
   # or
   docker compose down
   ```

### Manual Setup

1. **Install dependencies for all services:**
   ```bash
   npm run install:all
   ```

2. **Start each service individually:**
   ```bash
   # Terminal 1 - User Service
   cd services/rest-api
   npm run dev

   # Terminal 2 - Task Service
   cd services/graphql-api
   npm run dev

   # Terminal 3 - API Gateway
   cd api-gateway
   npm run dev

   # Terminal 4 - Frontend
   cd frontend-app
   npm run dev
   ```

## URLs

- Frontend: http://localhost:3002
- API Gateway: http://localhost:3000
- User Service: http://localhost:3001
- Task Service: http://localhost:4000/graphql

## API Examples

### Authentication

```bash
# Register new user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123"
  }'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'

# Response includes JWT token:
# {
#   "message": "Login successful",
#   "user": { ... },
#   "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
# }
```

### User Management (Protected)

```bash
# Get all users (requires JWT token)
curl http://localhost:3000/api/users \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get current user
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Team Management (Protected)

```bash
# Create team
curl -X POST http://localhost:3000/api/teams \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Development Team",
    "description": "Core development team",
    "members": ["user-id-1", "user-id-2"]
  }'

# Get all teams
curl http://localhost:3000/api/teams \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Task Management (GraphQL, Protected)

```graphql
# Query all tasks
query {
  tasks {
    id
    title
    description
    status
    priority
    assignedTo
    teamId
    createdBy
    createdAt
  }
}

# Create a task
mutation {
  createTask(
    title: "Setup Development Environment"
    description: "Install all necessary tools"
    status: todo
    priority: high
    assignedTo: "user-id-1"
    teamId: "team-id-1"
    createdBy: "user-id-1"
  ) {
    id
    title
    status
  }
}

# Update task status
mutation {
  updateTask(
    id: "task-id-1"
    status: completed
  ) {
    id
    title
    status
    updatedAt
  }
}

# Subscribe to real-time task updates
subscription {
  taskAdded {
    id
    title
    status
    priority
  }
}

subscription {
  taskUpdated {
    id
    title
    status
  }
}
```

## Environment Variables

### API Gateway
- `PORT`: Server port (default: 3000)
- `REST_API_URL`: User Service URL (default: http://localhost:3001)
- `GRAPHQL_API_URL`: Task Service URL (default: http://localhost:4000)

### Frontend
- `NEXT_PUBLIC_API_GATEWAY_URL`: API Gateway URL (default: http://localhost:3000)
- `NEXT_PUBLIC_GRAPHQL_URL`: GraphQL endpoint URL (default: http://localhost:4000/graphql)

## Project Structure

```
UTS/
├── api-gateway/                # API Gateway with JWT verification
│   ├── middleware/
│   │   └── auth.js            # JWT verification middleware
│   ├── package.json
│   ├── server.js
│   └── Dockerfile
├── services/
│   ├── rest-api/              # User Service (REST API)
│   │   ├── keys/
│   │   │   ├── private.key    # RSA private key for JWT signing
│   │   │   └── public.key     # RSA public key for JWT verification
│   │   ├── middleware/
│   │   ├── routes/
│   │   │   ├── auth.js        # Authentication routes
│   │   │   ├── users.js       # User CRUD routes
│   │   │   └── teams.js       # Team management routes
│   │   ├── package.json
│   │   ├── server.js
│   │   └── Dockerfile
│   └── graphql-api/           # Task Service (GraphQL API)
│       ├── package.json
│       ├── server.js
│       └── Dockerfile
├── frontend-app/              # Next.js frontend
│   ├── package.json
│   ├── next.config.js
│   ├── src/
│   └── Dockerfile
├── docker-compose.yml         # Production compose
├── docker-compose.dev.yml     # Development compose
└── package.json              # Root package.json
```

## Features Demonstrated

- **Microservices Architecture**: Separate services for different domains
- **API Gateway Pattern**: Single entry point with JWT authentication
- **JWT Authentication**: RS256 algorithm with RSA key pair
- **Password Security**: Bcrypt hashing for user passwords
- **GraphQL Subscriptions**: Real-time task updates
- **REST API**: Traditional HTTP API for user and team management
- **Modern Frontend**: React/Next.js with TypeScript
- **Containerization**: Docker setup for easy deployment
- **Development Environment**: Hot-reload and volume mounting

## Default Users

For testing, the following users are pre-configured:
- Email: `john@example.com`, Password: `password123` (admin)
- Email: `jane@example.com`, Password: `password123` (user)
