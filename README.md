# IssueTracker - Complete Project Management System

![System Architecture Diagram](./system-architecture.png)  
*Figure 1: High-Level System Architecture*

## Table of Contents
1. [Introduction](#1-introduction)
2. [Features](#2-features)
3. [Technology Stack](#3-technology-stack)
4. [Database Schema](#4-database-schema)
5. [API Reference](#5-api-reference)
   - [Authentication](#51-authentication)
   - [Companies](#52-companies)
   - [Projects](#53-projects)
   - [Issues](#54-issues)
   - [Users](#55-users)
6. [Models Documentation](#6-models-documentation)
   - [User Model](#61-user-model)
   - [Company Model](#62-company-model)
   - [Project Model](#63-project-model)
   - [Issue Model](#64-issue-model)
7. [Middleware](#7-middleware)
8. [Installation Guide](#8-installation-guide)
9. [Configuration](#9-configuration)
10. [Error Handling](#10-error-handling)
11. [Testing](#11-testing)
12. [Deployment](#12-deployment)
13. [ER Diagram](#13-er-diagram)
14. [API Flow](#14-api-flow)
15. [License](#15-license)

---

## 1. Introduction
IssueTracker is a full-featured issue tracking and project management system designed for software development teams. It provides:

- Complete issue lifecycle management
- Team collaboration features
- Real-time project tracking
- Comprehensive reporting
- Role-based access control

---

## 2. Features
### Core Functionality
| Feature | Description |
|---------|-------------|
| **User Management** | JWT authentication with role-based permissions |
| **Project Organization** | Create/manage projects with custom workflows |
| **Issue Tracking** | Full CRUD operations with attachments |
| **Team Collaboration** | Assignees, comments, and notifications |
| **Reporting** | Project statistics and progress tracking |

### Advanced Features
- File attachments (images, documents)
- Issue sub-tasks
- Customizable workflows
- Activity history tracking
- Advanced search and filtering
- Pagination for all collections
- Project statistics dashboard

---

## 3. Technology Stack
### Backend
| Component | Technology |
|-----------|------------|
| Runtime | Node.js |
| Framework | Express.js |
| ORM | Mongoose |
| Authentication | JWT |
| File Handling | Multer |
| Pagination | mongoose-paginate-v2 |

### Database
- MongoDB (NoSQL document database)

### Infrastructure
- Environment management: dotenv
- CORS handling: cors middleware
- Request parsing: express.json()

---

## 4. Database Schema
![ER Diagram](./er-diagram.png)  
*Figure 2: Entity Relationship Diagram*

### Collections Overview
1. **Users**
   - Company association
   - Authentication credentials
   - Role permissions
   - Profile information

2. **Companies**
   - Organizational data
   - User associations

3. **Projects**
   - Team structure
   - Configuration
   - Timeline

4. **Issues**
   - Tracking data
   - Relationships
   - Activity history

---

## 5. API Reference
### 5.1 Authentication
#### `POST /auth/register`
```json
{
  "company_id": "507f1f77bcf86cd799439011",
  "first_name": "John",
  "last_name": "Doe",
  "email": "john@example.com",
  "password": "securePassword123",
  "role": "developer",
  "avatar": "base64ImageString"
}
```
#### `POST /auth/login`
```json
{
  "email": "john@example.com",
  "password": "securePassword123"
}
```

### 5.2 Companies
#### `POST /companies`
```json
{
  "name": "Acme Corp",
  "email": "contact@acme.com"
}
```

### 5.3 Projects
#### `POST /projects`
```json
{
  "name": "Website Redesign",
  "key": "WRD",
  "description": "Complete overhaul of company website",
  "project_lead": "507f1f77bcf86cd799439012",
  "team_members": ["507f1f77bcf86cd799439013"],
  "categories": ["frontend", "design"]
}
```

### 5.3 Issues
#### `POST /issues
```json
{
  "project_id": "507f1f77bcf86cd799439014",
  "title": "Homepage loading slow",
  "description": "Homepage takes 5+ seconds to load on mobile",
  "issue_type": "bug",
  "priority": "high"
}
```
