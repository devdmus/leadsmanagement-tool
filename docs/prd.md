# Marketing Tracking Dashboard Requirements Document

## 1. Application Overview

### 1.1 Application Name
Marketing Tracking Dashboard

### 1.2 Application Description
A comprehensive dashboard system for tracking marketing leads from multiple sources (website forms, Facebook, LinkedIn, SEO), managing SEO meta tags, and enabling sales team follow-up with lead status tracking. The system includes role-based access control with Admin, Sales, SEO, and Client user roles, along with internal user-to-user chat capabilities for team communication. The application features an attractive, responsive UI/UX design with theme customization, collapsible sidebar menu, and includes subscription plan options for client users.

## 2. Core Features

### 2.1 Lead Management
- Capture and display leads from multiple sources: website forms, Facebook, LinkedIn, and SEO marketing
- Track lead data fields including: lead name, email, phone, source channel, timestamp, and conversion status
- Assign leads to sales users and SEO users
- Lead status tracking with options: Pending, Completed, Remainder
- Date and time tracking for each lead status update
- Follow-up tracking capability for assigned users
- Add notes to assigned leads for internal tracking and documentation
- Add specific notes explaining why a lead is marked as Pending or Remainder
- **Bulk edit options** for multiple leads simultaneously
- **Import and export leads** functionality
- **Follow-up system** integrated within leads for tracking follow-up activities
- **Table pagination** with filters for status, date, source, and search functionality
- **LinkedIn and Facebook integration** for lead capture

### 2.2 SEO Meta Tag Management
- Create, update, and delete SEO meta tags for website pages
- Manage SEO title, keywords, and description fields
- Apply meta tags to site pages
- **Table pagination** with filter and search functionality

### 2.3 Dashboard Visualization
- Display all leads with their current status
- Show lead distribution by source (Facebook, LinkedIn, form submissions, SEO)
- View assigned leads by user (sales and SEO team members)
- Track lead status changes with date and time stamps
- Overview of pending, completed, and remainder leads

### 2.4 User Role Management
- **Admin Role**: Full access to all dashboard features and activities, including user management and permission configuration
- **Sales Role**: Access to assigned leads with configurable read/write permissions set by Admin
- **SEO Role**: Access to SEO meta tag management and assigned leads with configurable read/write permissions set by Admin
- **Client Role**: Paid access with configurable read/write permissions set by Admin, subscription-based access with monthly, quarterly, and annual plans
- **Create users** based on role selection
- **Update user** information and permissions
- **User profile view and update** features for all users
- **Table pagination** with filter and search functionality for user management
- **Client subscription plans system** with three pricing tiers: Monthly, Quarterly, Annual

### 2.5 Permission Control System
- Admin can configure read and write access for Sales, SEO, and Client roles
- Granular permission settings for different dashboard features and activities
- Activity logging for all actions performed in the dashboard

### 2.6 Communication System
- Note-taking functionality for each assigned lead
- **Internal user-to-user chat system** for team communication
- Conversation history tracking with timestamps
- Ability to view all notes related to a specific lead

### 2.7 Client Subscription Management
- Display subscription plan options for client users: Monthly, Quarterly, and Annual
- Show pricing and features for each subscription tier
- Subscription plan selection interface for client users
- Subscription status tracking and management

### 2.8 UI/UX Design Requirements
- **Significantly improved UI/UX** with attractive and modern design
- **Responsive design** supporting desktop, tablet, and mobile devices
- **Animations** and smooth transitions for enhanced user experience
- **Better visual hierarchy** for improved content organization
- Intuitive navigation and user-friendly interactions
- Consistent design language across all pages and components
- **Theme color customization** options
- **Collapsible sidebar menu** with logo display
- Full responsive layout across all screen sizes

### 2.9 Dummy Data
- Pre-populated with sample data for all user roles (Admin, Sales, SEO, Client)
- Sample leads from various sources with different statuses
- Example SEO meta tags
- Sample notes and follow-up records
- Demo activity logs
- Sample user-to-user chat conversations

## 3. Technical Requirements

### 3.1 Frontend
- Built with React
- Responsive design supporting multiple screen sizes

### 3.2 Backend
- MySQL database for data storage

## 4. Key Data Fields

### 4.1 Lead Information
- Lead ID
- Lead name
- Email
- Phone
- Source channel (Facebook, LinkedIn, Form, SEO)
- Timestamp (creation date and time)
- Assigned user (sales or SEO user)
- Status (Pending, Completed, Remainder)
- Status update date and time
- Follow-up notes
- Pending/Remainder reason notes
- Follow-up system tracking data

### 4.2 SEO Meta Tags
- Page identifier
- SEO title
- Keywords
- Description
- Creation/update timestamp

### 4.3 User Information
- User ID
- Username
- Role (Admin, Sales, SEO, Client)
- Access permissions (read/write settings)
- Client subscription plan (Monthly, Quarterly, Annual)
- Subscription status and expiration date
- User profile information
- Theme preferences

### 4.4 Activity Log
- Activity ID
- User ID
- Action performed
- Timestamp
- Affected resource/data

### 4.5 Notes
- Note ID
- Lead ID
- User ID (author)
- Content
- Timestamp
- Note type (general note, pending reason, remainder reason)

### 4.6 User-to-User Chat Messages
- Message ID
- Sender User ID
- Receiver User ID
- Content
- Timestamp
- Read status

### 4.7 Subscription Plans
- Plan ID
- Plan name (Monthly, Quarterly, Annual)
- Pricing
- Features included
- Duration

### 4.8 Follow-up System Data
- Follow-up ID
- Lead ID
- Assigned User ID
- Follow-up date and time
- Follow-up status
- Follow-up notes

### 4.9 Lead Import/Export Data
- Import/export format specifications
- Field mapping configurations
- Bulk operation logs