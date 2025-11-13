const express = require('express');
const { ApolloServer } = require('apollo-server-express');
const { PubSub } = require('graphql-subscriptions');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const app = express();
const pubsub = new PubSub();

// Enable CORS
app.use(cors({
  origin: [
    'http://localhost:3000', // API Gateway
    'http://localhost:3002', // Frontend
    'http://api-gateway:3000', // Docker container name
    'http://frontend-app:3002' // Docker container name
  ],
  credentials: true
}));

// In-memory data store (replace with real database in production)
let tasks = [
  {
    id: '1',
    title: 'Setup Project',
    description: 'Initialize the task management project',
    status: 'completed',
    priority: 'high',
    assignedTo: '1',
    teamId: '1',
    createdBy: '1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '2',
    title: 'Design Database Schema',
    description: 'Design the database schema for task management',
    status: 'in_progress',
    priority: 'high',
    assignedTo: '2',
    teamId: '1',
    createdBy: '1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
];

// GraphQL type definitions
const typeDefs = `
  enum TaskStatus {
    todo
    in_progress
    completed
    cancelled
  }
  
  enum TaskPriority {
    low
    medium
    high
    urgent
  }

  type Task {
    id: ID!
    title: String!
    description: String
    status: TaskStatus!
    priority: TaskPriority!
    assignedTo: String
    teamId: String
    createdBy: String!
    createdAt: String!
    updatedAt: String!
  }

  type Query {
    tasks: [Task!]!
    task(id: ID!): Task
    tasksByUser(userId: String!): [Task!]!
    tasksByTeam(teamId: String!): [Task!]!
    tasksByStatus(status: TaskStatus!): [Task!]!
  }

  type Mutation {
    createTask(
      title: String!
      description: String
      status: TaskStatus
      priority: TaskPriority
      assignedTo: String
      teamId: String
      createdBy: String!
    ): Task!
    
    updateTask(
      id: ID!
      title: String
      description: String
      status: TaskStatus
      priority: TaskPriority
      assignedTo: String
      teamId: String
    ): Task!
    
    deleteTask(id: ID!): Boolean!
  }

  type Subscription {
    taskAdded: Task!
    taskUpdated: Task!
    taskDeleted: ID!
  }
`;

// GraphQL resolvers
const resolvers = {
  Query: {
    tasks: () => tasks,
    task: (_, { id }) => tasks.find(task => task.id === id),
    tasksByUser: (_, { userId }) => tasks.filter(task => task.assignedTo === userId),
    tasksByTeam: (_, { teamId }) => tasks.filter(task => task.teamId === teamId),
    tasksByStatus: (_, { status }) => tasks.filter(task => task.status === status),
  },

  Mutation: {
    createTask: (_, { title, description, status, priority, assignedTo, teamId, createdBy }) => {
      const newTask = {
        id: uuidv4(),
        title,
        description: description || '',
        status: status || 'todo',
        priority: priority || 'medium',
        assignedTo: assignedTo || null,
        teamId: teamId || null,
        createdBy,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      tasks.push(newTask);
      
      // Publish to subscribers
      pubsub.publish('TASK_ADDED', { taskAdded: newTask });
      
      return newTask;
    },

    updateTask: (_, { id, title, description, status, priority, assignedTo, teamId }) => {
      const taskIndex = tasks.findIndex(task => task.id === id);
      if (taskIndex === -1) {
        throw new Error('Task not found');
      }

      const updatedTask = {
        ...tasks[taskIndex],
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(status && { status }),
        ...(priority && { priority }),
        ...(assignedTo !== undefined && { assignedTo }),
        ...(teamId !== undefined && { teamId }),
        updatedAt: new Date().toISOString(),
      };

      tasks[taskIndex] = updatedTask;
      
      // Publish to subscribers
      pubsub.publish('TASK_UPDATED', { taskUpdated: updatedTask });
      
      return updatedTask;
    },

    deleteTask: (_, { id }) => {
      const taskIndex = tasks.findIndex(task => task.id === id);
      if (taskIndex === -1) {
        return false;
      }

      tasks.splice(taskIndex, 1);
      
      // Publish to subscribers
      pubsub.publish('TASK_DELETED', { taskDeleted: id });
      
      return true;
    },
  },

  Subscription: {
    taskAdded: {
      subscribe: () => pubsub.asyncIterator(['TASK_ADDED']),
    },
    taskUpdated: {
      subscribe: () => pubsub.asyncIterator(['TASK_UPDATED']),
    },
    taskDeleted: {
      subscribe: () => pubsub.asyncIterator(['TASK_DELETED']),
    },
  },
};

async function startServer() {
  // Create Apollo Server
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: ({ req }) => {
      // Add authentication logic here if needed
      return { req };
    },
    plugins: [
      {
        requestDidStart() {
          return {
            willSendResponse(requestContext) {
              console.log(`GraphQL ${requestContext.request.operationName || 'Anonymous'} operation completed`);
            },
          };
        },
      },
    ],
  });

  await server.start();
  server.applyMiddleware({ app, path: '/graphql' });

  const PORT = process.env.PORT || 4000;
  
  const httpServer = app.listen(PORT, () => {
    console.log(`🚀 Task Service (GraphQL API) running on port ${PORT}`);
    console.log(`🔗 GraphQL endpoint: http://localhost:${PORT}${server.graphqlPath}`);
    console.log(`📊 GraphQL Playground: http://localhost:${PORT}${server.graphqlPath}`);
    console.log(`📡 Real-time subscriptions ready`);
  });

  // Setup subscriptions
  server.installSubscriptionHandlers(httpServer);

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    httpServer.close(() => {
      console.log('Process terminated');
    });
  });
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'Task Service (GraphQL API)',
    timestamp: new Date().toISOString(),
    data: {
      tasks: tasks.length
    }
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Task Service Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

startServer().catch(error => {
  console.error('Failed to start Task Service:', error);
  process.exit(1);
});