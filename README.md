# StreamMate

This project enables you to initiate a video chat with a friend in one click, including screen sharing capabilities. Built with  WebRTC for real-time communication, socketio server for efficient signaling, and nextjs for the frontend.

## Features

- **One-Click Video Chat**: Start a video call with a friend with a single click.
- **Screen Sharing**: Share your screen during the video call for enhanced collaboration.
- **Perfect Negotiation**: Ensures seamless WebRTC connections.
- **Real-time Communication**: Utilizes Socket.IO for efficient signaling and real-time updates.

## Tech Stack

- **Frontend**:
  - Next.js
  - Typescript
  - ShadcnUi
  - TailwindCSS
- **Backend**:
  - Node.js
  - Socket.IO

## Getting Started

### Prerequisites

Make sure you have the following installed on your machine:

- Node.js (v14 or higher)
- pnpm

### Installation

1. **Clone the repository**:
    ```bash
    git clone https://github.com/senbo1/StreamMate.git
    cd StreamMate
    ```

2. **Install dependencies**:
    ```bash
    cd web
    npm install
    cd ../server
    npm install
    ```

### Running the Application

1. **Start the Signaling Server**:
    ```bash
    cd server
    pnpm run dev
    ```

2. **Start the Next.js Application**:
    In a new terminal window, run the following command:
    ```bash
    cd /web
    pnpm run dev
    ```

3. **Open your browser** and navigate to `http://localhost:3000`.


## Contributing

To contribute:

1. Fork the repository.
2. Create a new branch (`git checkout -b feature/your-feature`).
3. Commit your changes (`git commit -m 'Add your feature'`).
4. Push to the branch (`git push origin feature/your-feature`).
5. Open a pull request.


---
