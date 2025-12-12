# Oborishte Map

A Next.js application for reporting and tracking issues in Oborishte District, Sofia, Bulgaria. The application uses Google Cloud Firestore for data storage, Google AI (Gemini) for extracting addresses from free text, and Google Maps for visualization.

## Features

- **Message Submission**: Users can submit free-text messages describing issues or locations
- **AI Address Extraction**: Automatically extracts addresses from messages using Google Gemini AI
- **Geocoding**: Converts extracted addresses to coordinates using Google Maps Geocoding API
- **Interactive Map**: Displays all locations on an interactive Google Map centered on Oborishte District
- **Info Windows**: Click markers on the map to view the original message and address details
- **Real-time Updates**: Messages are stored in Firestore and displayed in real-time

## Technology Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Google Cloud Firestore (NoSQL)
- **AI**: Google Generative AI (Gemini)
- **Maps**: Google Maps JavaScript API, Geocoding API
- **Deployment**: Can be deployed on Vercel or any Node.js hosting platform

## Prerequisites

Before setting up the application, you need to obtain the following API keys and credentials:

1. **Google Cloud Project** with the following APIs enabled:
   - Firestore API
   - Maps JavaScript API
   - Geocoding API
   - Google Generative AI API

2. **Firebase Configuration** for your Firestore database

3. **API Keys**:
   - Google Maps API Key (with Maps JavaScript API and Geocoding API enabled)
   - Google AI API Key (for Gemini)

## Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/vbuch/oborishte-map.git
cd oborishte-map
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Copy the `.env.example` file to `.env.local`:

```bash
cp .env.example .env.local
```

Edit `.env.local` and add your actual API keys and Firebase configuration:

```env
# Google Maps API Key
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here

# Google Gemini AI API Key
GOOGLE_AI_API_KEY=your_google_ai_api_key_here

# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### 4. Set Up Firebase/Firestore

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or use an existing one
3. Enable Firestore Database in your project
4. Create a collection named `messages` (this will be created automatically when the first message is submitted)
5. Copy your Firebase configuration values to `.env.local`

### 5. Enable Google Cloud APIs

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the following APIs:
   - Maps JavaScript API
   - Geocoding API
   - Generative Language API (for Gemini)
3. Create API credentials and add them to `.env.local`

### 6. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## Usage

1. **Submit a Message**: Enter a message containing addresses in the Oborishte District area. For example:
   ```
   There's a pothole on ul. Oborishte 15, near the intersection with Rakovska Street.
   ```

2. **AI Processing**: The application will automatically:
   - Extract addresses from your message using Google AI
   - Geocode the addresses to get coordinates
   - Store the message and location data in Firestore

3. **View on Map**: The locations will appear as markers on the Google Map. Click any marker to see the original message in an info window.

4. **Browse Messages**: Scroll down to see a list of all recent messages and their extracted addresses.

## Project Structure

```
oborishte-map/
├── app/
│   ├── api/
│   │   └── messages/
│   │       └── route.ts          # API endpoints for messages
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Main page component
│   └── globals.css               # Global styles
├── components/
│   ├── MapComponent.tsx          # Google Maps component
│   └── MessageForm.tsx           # Message submission form
├── lib/
│   ├── firebase.ts               # Firebase configuration
│   ├── types.ts                  # TypeScript type definitions
│   ├── ai-service.ts             # Google AI integration
│   └── geocoding-service.ts      # Geocoding utilities
├── .env.example                  # Environment variables template
└── package.json                  # Project dependencies
```

## Deployment

### Deploy on Vercel

The easiest way to deploy this application is using [Vercel](https://vercel.com):

1. Push your code to GitHub
2. Import your repository in Vercel
3. Add all environment variables from `.env.local` in the Vercel project settings
4. Deploy

Vercel will automatically detect Next.js and configure the build settings.

### Deploy on Other Platforms

For deployment on other platforms:

1. Build the application:
   ```bash
   npm run build
   ```

2. Start the production server:
   ```bash
   npm start
   ```

3. Ensure all environment variables are configured on your hosting platform

## Development

- **Build**: `npm run build` - Creates an optimized production build
- **Start**: `npm start` - Starts the production server
- **Dev**: `npm run dev` - Starts the development server with hot reload

## Data Schema

### Message Document (Firestore)

```typescript
{
  text: string,              // Original message text
  addresses: [               // Array of extracted and geocoded addresses
    {
      originalText: string,  // Address as extracted by AI
      formattedAddress: string, // Formatted address from Google Maps
      coordinates: {
        lat: number,
        lng: number
      },
      geoJson: {             // GeoJSON Point format
        type: "Point",
        coordinates: [lng, lat]
      }
    }
  ],
  createdAt: Timestamp       // Message creation timestamp
}
```

## License

This project is open source and available under the MIT License.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
