// OpenAI DALL-E service to generate car images based on user's car model
// IMPORTANT: Replace with your actual OpenAI API key to enable car image generation
const OPENAI_API_KEY = 'YOUR_OPENAI_API_KEY';

export const generateCarImage = async (carModel: string): Promise<string | null> => {
  if (!OPENAI_API_KEY || OPENAI_API_KEY === 'YOUR_OPENAI_API_KEY') {
    console.warn('OpenAI API key not set — skipping image generation');
    return null;
  }

  try {
    const prompt = `A photorealistic side view of a ${carModel} car, studio lighting, dark green/black gradient background, professional automotive photography, high quality, centered in frame, no text`;

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: '1792x1024',
        quality: 'standard',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API error:', errorData);
      return null;
    }

    const data = await response.json();
    return data.data?.[0]?.url ?? null;
  } catch (error) {
    console.error('Failed to generate car image:', error);
    return null;
  }
};

// Fallback: search for a car image using a free API
export const searchCarImage = async (carModel: string): Promise<string | null> => {
  try {
    // Use a placeholder car image URL based on the model name
    const encoded = encodeURIComponent(carModel);
    return `https://source.unsplash.com/800x400/?${encoded}+car`;
  } catch (error) {
    console.error('Failed to search car image:', error);
    return null;
  }
};
export const scanVin = async (vin: string): Promise<{ model: string | null; make: string | null; modelYear: string | null } | null> => {
  try {
    const url = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${encodeURIComponent(vin)}?format=json`;
    const response = await fetch(url);
    if (!response.ok) {
      console.error('scanVin non-OK response', { status: response.status, statusText: response.statusText, url });
      return null;
    }
    const data = await response.json();
    const results = Array.isArray(data?.Results) ? data.Results : [];
    const model = results.find((result: any) => result?.Variable === 'Model')?.Value ?? null;
    const make = results.find((result: any) => result?.Variable === 'Make')?.Value ?? null;
    const modelYear = results.find((result: any) => result?.Variable === 'Model Year')?.Value ?? null;
    return {
      model,
      make,
      modelYear,
    };
  } catch (error) {
    console.error('scanVin failed:', error);
    return null;
  }
};
