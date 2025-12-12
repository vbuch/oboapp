'use client';

import React, { useState } from 'react';

interface MessageFormProps {
  onMessageSubmit: () => void;
}

export default function MessageForm({ onMessageSubmit }: MessageFormProps) {
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit message');
      }

      setText('');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      onMessageSubmit();
    } catch (err) {
      setError('Failed to submit message. Please try again.');
      console.error('Error submitting message:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-xl font-semibold mb-4">Submit a Message</h2>
      <div className="mb-4">
        <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
          Enter your message (include addresses in Sofia, Oborishte):
        </label>
        <textarea
          id="message"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
          rows={4}
          placeholder="Example: There's a pothole on ul. Oborishte 15, near the intersection with Rakovska Street."
          required
          disabled={isSubmitting}
        />
      </div>
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-md text-sm">
          Message submitted successfully! Processing addresses...
        </div>
      )}
      <button
        type="submit"
        disabled={isSubmitting || !text.trim()}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
      >
        {isSubmitting ? 'Submitting...' : 'Submit Message'}
      </button>
    </form>
  );
}
