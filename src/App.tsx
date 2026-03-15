/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Mic, MicOff, Image as ImageIcon, Loader2, RefreshCw, Wand2, Volume2, VolumeX, Sparkles, Sun, Zap, Eye, Palette, Layers, Mountain, Building2, Eraser, Download, Focus, Maximize2, Undo, Redo, Moon, Palmtree, Star, Cloud, Droplets, Camera, Lightbulb, MapPin, Wind, Smile, Film, Grid, Scissors, Pencil, Leaf, Thermometer, Waves, Brush, Contrast, Type, Triangle, Trash2, PlusSquare, Expand, UserCircle, Briefcase, Baby, CloudRain, Snowflake, Brain, Home, Coffee, Book, Flower2, Columns, Shirt, Box } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ai, EDIT_IMAGE_TOOL, performImageEdit } from './lib/gemini';
import { resizeImage } from './lib/utils';
import { AudioHandler } from './lib/audio';
import { LiveServerMessage, Modality } from "@google/genai";

export default function App() {
  const [image, setImage] = useState<string | null>(null);
  const [imageHistory, setImageHistory] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('image/png');
  const [isLive, setIsLive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [isSplitView, setIsSplitView] = useState(false);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [status, setStatus] = useState<string>('Ready');
  const [thinkingMessage, setThinkingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [transcription, setTranscription] = useState<string>('');
  const [isMuted, setIsMuted] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');

  const imageRef = useRef<string | null>(null);
  const mimeTypeRef = useRef<string>('image/png');
  const audioHandlerRef = useRef<AudioHandler | null>(null);
  const sessionRef = useRef<any>(null);

  // Sync refs with state to avoid stale closures in live session
  useEffect(() => {
    imageRef.current = image;
  }, [image]);

  useEffect(() => {
    mimeTypeRef.current = mimeType;
  }, [mimeType]);

  const [activeTab, setActiveTab] = useState<'magic' | 'edit' | 'bg' | 'creative' | 'ai'>('magic');

  const ensureApiKey = async () => {
    const aistudio = (window as any).aistudio;
    if (aistudio) {
      const hasKey = await aistudio.hasSelectedApiKey();
      if (!hasKey) {
        await aistudio.openSelectKey();
        return true; // Assume success after opening dialog
      }
    }
    return true;
  };

  const handleUndo = () => {
    if (imageHistory.length > 0) {
      const previousImage = imageHistory[imageHistory.length - 1];
      setRedoStack(prev => [image!, ...prev]);
      setImageHistory(prev => prev.slice(0, -1));
      setImage(previousImage);
    }
  };

  const handleRedo = () => {
    if (redoStack.length > 0) {
      const nextImage = redoStack[0];
      setImageHistory(prev => [...prev, image!]);
      setRedoStack(prev => prev.slice(1));
      setImage(nextImage);
    }
  };

  const handleDownload = () => {
    if (!image) return;
    const link = document.createElement('a');
    link.href = image;
    link.download = `enhanced-image-${Date.now()}.${mimeType.split('/')[1] || 'png'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const TABS = [
    { id: 'magic', label: 'Magic', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'ai', label: 'Gen AI', icon: <Brain className="w-4 h-4" /> },
    { id: 'edit', label: 'Edit', icon: <Zap className="w-4 h-4" /> },
    { id: 'bg', label: 'Backdrop', icon: <Layers className="w-4 h-4" /> },
    { id: 'creative', label: 'Artistic', icon: <Palette className="w-4 h-4" /> },
  ] as const;

  const QUICK_ACTIONS = [
    { id: 'colorize', label: 'Colorize', icon: <ImageIcon className="w-4 h-4" />, instruction: 'Colorize this image, making it look natural and vibrant.', size: '512px' },
    { id: 'sharpen', label: 'Sharpen', icon: <Zap className="w-4 h-4" />, instruction: 'Increase the sharpness and clarity of this image, bringing out the fine details.', size: '512px' },
    { id: 'brighten', label: 'Brighten', icon: <Sun className="w-4 h-4" />, instruction: 'Increase the brightness and exposure of this image for a clearer look.', size: '512px' },
    { id: 'vivid', label: 'Vivid', icon: <Wand2 className="w-4 h-4" />, instruction: 'Apply vivid colors and enhance the saturation to make the image pop.', size: '512px' },
    { id: 'focus', label: 'Focus', icon: <Focus className="w-4 h-4" />, instruction: 'Apply an advanced deblurring algorithm to this photo to completely remove all blur, restore high-frequency details, and make it look like a perfectly focused, sharp, and clear image.' },
    { id: 'de-shadow', label: 'De-Shadow', icon: <Sun className="w-4 h-4" />, instruction: 'Lift heavy shadows to reveal hidden details in dark areas without overexposing highlights.', size: '512px' },
    { id: 'hdr', label: 'HDR Look', icon: <Sparkles className="w-4 h-4" />, instruction: 'Balance highlights and shadows for a high-dynamic-range, punchy appearance.', size: '512px' },
    { id: 'de-noise', label: 'De-Noise', icon: <Droplets className="w-4 h-4" />, instruction: 'Remove digital grain and "noise" from photos taken in low-light conditions.', size: '512px' },
    { id: 'texture', label: 'Texture', icon: <Maximize2 className="w-4 h-4" />, instruction: 'Enhance micro-contrast to make textures like fabric, wood, or stone stand out.', size: '512px' },
    { id: 'de-haze', label: 'De-Haze', icon: <Wind className="w-4 h-4" />, instruction: 'Remove atmospheric haze or fog to make distant landscapes look clear and crisp.', size: '512px' },
    { id: 'eye-pop', label: 'Eye Pop', icon: <Eye className="w-4 h-4" />, instruction: 'Specifically brighten and sharpen eyes to make portraits more engaging.', size: '512px' },
    { id: 'teeth-whiten', label: 'Teeth Whiten', icon: <Smile className="w-4 h-4" />, instruction: 'Naturally whiten teeth for a perfect smile.', size: '512px' },
    { id: 'skin-glow', label: 'Skin Glow', icon: <Sparkles className="w-4 h-4" />, instruction: 'Add a subtle, healthy radiance to skin tones.', size: '512px' },
    { id: 'sky-enhance', label: 'Sky Enhance', icon: <Cloud className="w-4 h-4" />, instruction: 'Deepen the blue of the sky and make clouds more defined.', size: '512px' },
    { id: 'upscale-2x', label: '2x Upscale', icon: <Maximize2 className="w-4 h-4" />, instruction: 'Upscale the image by 2x, enhancing resolution while maintaining image quality and sharpness.' },
    { id: 'upscale-4x', label: '4x Upscale', icon: <Maximize2 className="w-4 h-4" />, instruction: 'Upscale the image by 4x, significantly increasing resolution and detail for high-quality printing or large displays.' },
  ];

  const BACKGROUND_ACTIONS = [
    { id: 'bg-white', label: 'White BG', icon: <Eraser className="w-4 h-4" />, instruction: 'Remove the background and replace it with a clean, solid white studio background.' },
    { id: 'bg-grey', label: 'Grey Studio', icon: <Camera className="w-4 h-4" />, instruction: 'Replace the background with a neutral, professional grey studio backdrop.' },
    { id: 'bg-black', label: 'Black Minimal', icon: <Moon className="w-4 h-4" />, instruction: 'Replace the background with a deep, solid black minimalist backdrop for a dramatic look.' },
    { id: 'bg-softbox', label: 'Softbox', icon: <Lightbulb className="w-4 h-4" />, instruction: 'Simulate a professional studio setup with soft, directional lighting on a clean background.' },
    { id: 'bg-beach', label: 'Beach', icon: <Palmtree className="w-4 h-4" />, instruction: 'Replace the background with a serene tropical beach with white sand and palm trees.' },
    { id: 'bg-rooftop', label: 'Rooftop', icon: <Building2 className="w-4 h-4" />, instruction: 'Replace the background with a modern urban rooftop view of a city skyline at dusk.' },
    { id: 'bg-galaxy', label: 'Galaxy', icon: <Star className="w-4 h-4" />, instruction: 'Replace the background with a stunning, surreal galaxy featuring stars and colorful nebulae.' },
    { id: 'bg-paris', label: 'Paris', icon: <MapPin className="w-4 h-4" />, instruction: 'Replace the background with a classic, romantic Parisian street scene.' },
    { id: 'bg-tokyo', label: 'Tokyo', icon: <Zap className="w-4 h-4" />, instruction: 'Replace the background with a vibrant, neon-lit street in Tokyo, Japan.' },
    { id: 'bg-london', label: 'London', icon: <Building2 className="w-4 h-4" />, instruction: 'Replace the background with a classic London scene featuring Big Ben and the Thames.' },
    { id: 'bg-nyc', label: 'New York', icon: <Building2 className="w-4 h-4" />, instruction: 'Replace the background with the iconic Times Square in New York City at night.' },
    { id: 'bg-rome', label: 'Rome', icon: <Building2 className="w-4 h-4" />, instruction: 'Replace the background with the historic Colosseum in Rome, Italy.' },
    { id: 'bg-santorini', label: 'Santorini', icon: <Waves className="w-4 h-4" />, instruction: 'Replace the background with the beautiful blue-domed churches and white buildings of Santorini, Greece.' },
    { id: 'bg-bali', label: 'Bali', icon: <Leaf className="w-4 h-4" />, instruction: 'Replace the background with lush green rice terraces in Bali, Indonesia.' },
    { id: 'bg-alps', label: 'Swiss Alps', icon: <Mountain className="w-4 h-4" />, instruction: 'Replace the background with snow-capped peaks of the Swiss Alps.' },
    { id: 'bg-pyramids', label: 'Pyramids', icon: <Sun className="w-4 h-4" />, instruction: 'Replace the background with the ancient Giza Pyramids in Egypt.' },
    { id: 'bg-sydney', label: 'Sydney', icon: <Waves className="w-4 h-4" />, instruction: 'Replace the background with the iconic Sydney Opera House and Harbour Bridge.' },
    { id: 'bg-china', label: 'Great Wall', icon: <Mountain className="w-4 h-4" />, instruction: 'Replace the background with the majestic Great Wall of China winding through mountains.' },
    { id: 'bg-taj', label: 'Taj Mahal', icon: <Building2 className="w-4 h-4" />, instruction: 'Replace the background with the stunning white marble Taj Mahal in Agra, India.' },
    { id: 'bg-kandy', label: 'Kandy', icon: <Mountain className="w-4 h-4" />, instruction: 'Replace the background with a scenic view of Kandy, Sri Lanka, featuring the Kandy Lake and lush green hills.' },
    { id: 'bg-penthouse', label: 'Penthouse', icon: <Home className="w-4 h-4" />, instruction: 'Replace the background with a high-end, modern penthouse living room with floor-to-ceiling windows.' },
    { id: 'bg-cafe', label: 'Cozy Cafe', icon: <Coffee className="w-4 h-4" />, instruction: 'Replace the background with a warm, rustic coffee shop with soft lighting and wooden textures.' },
    { id: 'bg-library', label: 'Library', icon: <Book className="w-4 h-4" />, instruction: 'Replace the background with a grand library featuring tall mahogany bookshelves and a classic atmosphere.' },
    { id: 'bg-office', label: 'Modern Office', icon: <Briefcase className="w-4 h-4" />, instruction: 'Replace the background with a clean, professional modern office workspace.' },
    { id: 'bg-autumn', label: 'Autumn', icon: <Leaf className="w-4 h-4" />, instruction: 'Replace the background with a vibrant autumn forest with orange and red leaves and golden sunlight.' },
    { id: 'bg-winter', label: 'Winter', icon: <Snowflake className="w-4 h-4" />, instruction: 'Replace the background with a peaceful, snow-covered pine forest in winter.' },
    { id: 'bg-rainy', label: 'Rainy Day', icon: <CloudRain className="w-4 h-4" />, instruction: 'Replace the background with a moody cinematic view through a rain-streaked window at night.' },
    { id: 'bg-garden', label: 'Garden', icon: <Flower2 className="w-4 h-4" />, instruction: 'Replace the background with a bright, colorful spring flower garden in full bloom.' },
    { id: 'bg-brick', label: 'Brick Wall', icon: <Grid className="w-4 h-4" />, instruction: 'Replace the background with a trendy, industrial loft-style red brick wall.' },
    { id: 'bg-marble', label: 'Marble', icon: <Grid className="w-4 h-4" />, instruction: 'Replace the background with a clean, high-end luxury white marble stone texture.' },
    { id: 'bg-concrete', label: 'Concrete', icon: <Building2 className="w-4 h-4" />, instruction: 'Replace the background with a gritty, brutalist raw concrete architectural wall.' },
    { id: 'bg-wood', label: 'Wood Panel', icon: <Columns className="w-4 h-4" />, instruction: 'Replace the background with a warm, mid-century modern wooden slat wall.' },
    { id: 'bg-enchanted', label: 'Enchanted', icon: <Sparkles className="w-4 h-4" />, instruction: 'Replace the background with a magical enchanted forest with glowing plants and fireflies.' },
    { id: 'bg-underwater', label: 'Underwater', icon: <Waves className="w-4 h-4" />, instruction: 'Replace the background with a deep blue aquatic scene with light rays filtering through the surface.' },
    { id: 'bg-mars', label: 'Mars', icon: <Mountain className="w-4 h-4" />, instruction: 'Replace the background with a red, rocky Martian landscape under a dark sky.' },
    { id: 'bg-cyberpunk', label: 'Cyber Alley', icon: <Zap className="w-4 h-4" />, instruction: 'Replace the background with a gritty, rain-slicked cyberpunk alleyway with heavy neon reflections.' },
    { id: 'bg-neon', label: 'Neon', icon: <Zap className="w-4 h-4" />, instruction: 'Replace the background with vibrant cyberpunk-style neon lights and futuristic city elements.' },
    { id: 'bg-clouds', label: 'Clouds', icon: <Cloud className="w-4 h-4" />, instruction: 'Replace the background with soft, ethereal white clouds in a blue sky.' },
    { id: 'bg-gradient', label: 'Gradient', icon: <Palette className="w-4 h-4" />, instruction: 'Replace the background with a smooth, modern abstract color gradient.' },
    { id: 'bg-bokeh', label: 'Bokeh', icon: <Focus className="w-4 h-4" />, instruction: 'Apply a heavy, professional bokeh blur to the existing background while keeping the subject sharp.' },
    { id: 'bg-splash', label: 'Color Splash', icon: <Droplets className="w-4 h-4" />, instruction: 'Keep the subject in full color but turn the entire background into a high-contrast black and white.' },
    { id: 'bg-transparent', label: 'Transparent', icon: <Eraser className="w-4 h-4" />, instruction: 'Remove the background completely, leaving only the subject on a transparent layer.' },
  ];

  const CREATIVE_ACTIONS = [
    { id: 'sketch', label: 'Sketch', icon: <Palette className="w-4 h-4" />, instruction: 'Transform this image into a detailed pencil sketch.', size: '512px' },
    { id: 'night', label: 'Night Fix', icon: <Sun className="w-4 h-4" />, instruction: 'Improve this low-light photo, reducing noise and bringing out hidden details in the shadows.', size: '512px' },
    { id: 'retouch', label: 'Retouch', icon: <Sparkles className="w-4 h-4" />, instruction: 'Apply subtle skin smoothing and eye brightening to any faces in the image.', size: '512px' },
    { id: 'vintage', label: 'Vintage', icon: <ImageIcon className="w-4 h-4" />, instruction: 'Apply a classic 1970s vintage film look with warm tones and slight grain.', size: '512px' },
    { id: 'oil', label: 'Oil Painting', icon: <Palette className="w-4 h-4" />, instruction: 'Transform the photo into a textured, brush-stroke-heavy oil painting.' },
    { id: 'vangogh', label: 'Van Gogh', icon: <Palette className="w-4 h-4" />, instruction: 'Transform this image into a post-impressionist masterpiece in the style of Vincent van Gogh, with thick, swirling brushstrokes and bold, expressive colors.' },
    { id: 'watercolor', label: 'Watercolor', icon: <Palette className="w-4 h-4" />, instruction: 'Soften edges and create a fluid, artistic watercolor effect.' },
    { id: 'popart', label: 'Pop Art', icon: <Palette className="w-4 h-4" />, instruction: 'Apply bold colors and high-contrast patterns inspired by Warhol or Lichtenstein.' },
    { id: 'noir', label: 'Cinematic Noir', icon: <Palette className="w-4 h-4" />, instruction: 'Transform this image into a high-contrast, moody black-and-white photo with dramatic, deep shadows.', size: '512px' },
    { id: 'golden', label: 'Golden Hour', icon: <Sun className="w-4 h-4" />, instruction: 'Apply warm, soft, glowing lighting that mimics the hour before sunset.', size: '512px' },
    { id: 'retro', label: 'Retro/Vintage', icon: <ImageIcon className="w-4 h-4" />, instruction: 'Add film grain, light leaks, and color shifts to mimic 70s or 80s film stock.', size: '512px' },
    { id: 'neon', label: 'Neon/Cyberpunk', icon: <Zap className="w-4 h-4" />, instruction: 'Enhance highlights with vibrant neon glows and high-contrast, moody color palettes.', size: '512px' },
    { id: 'double', label: 'Double Exposure', icon: <Layers className="w-4 h-4" />, instruction: 'Create a surreal, layered double exposure composition by blending abstract elements into the image.' },
    { id: 'glitch', label: 'Glitch', icon: <RefreshCw className="w-4 h-4" />, instruction: 'Introduce digital artifacts, color shifting, and distortion for a modern, edgy glitch look.', size: '512px' },
    { id: 'bokeh', label: 'Dreamy Bokeh', icon: <Focus className="w-4 h-4" />, instruction: 'Enhance the depth of field to create a soft, out-of-focus background effect that makes the subject pop.', size: '512px' },
    { id: 'cinematic', label: 'Cinematic', icon: <Film className="w-4 h-4" />, instruction: 'Apply the popular cinematic color grade used in blockbuster movies with a professional Teal & Orange look.', size: '512px' },
    { id: 'anime', label: 'Anime', icon: <Smile className="w-4 h-4" />, instruction: 'Transform this image into a vibrant, cel-shaded Japanese animation style with bold outlines.', size: '512px' },
    { id: 'pixel', label: 'Pixel Art', icon: <Grid className="w-4 h-4" />, instruction: 'Transform this photo into a retro 8-bit or 16-bit video game aesthetic.', size: '512px' },
    { id: 'cutout', label: 'Paper Cutout', icon: <Scissors className="w-4 h-4" />, instruction: 'Create a layered, 3D effect that looks like the image was crafted from stacked colored paper.', size: '512px' },
    { id: 'blueprint', label: 'Blueprint', icon: <Pencil className="w-4 h-4" />, instruction: 'Transform this image into a technical, architectural blueprint with white lines on a deep blue background.', size: '512px' },
    { id: 'infrared', label: 'Infrared', icon: <Leaf className="w-4 h-4" />, instruction: 'Apply a surreal Aerochrome look where foliage turns bright pink or red, mimicking infrared film.', size: '512px' },
    { id: 'thermal', label: 'Thermal', icon: <Thermometer className="w-4 h-4" />, instruction: 'Apply a high-energy thermal vision heat map look using vibrant reds, yellows, and deep blues.', size: '512px' },
    { id: 'glass', label: 'Stained Glass', icon: <Grid className="w-4 h-4" />, instruction: 'Turn the image into a mosaic of vibrant glass shards separated by dark lead lines.', size: '512px' },
    { id: 'ukiyo', label: 'Ukiyo-e', icon: <Waves className="w-4 h-4" />, instruction: 'Transform this image into a traditional Japanese woodblock print with flat colors and elegant linework.', size: '512px' },
    { id: 'chiaroscuro', label: 'Renaissance', icon: <Brush className="w-4 h-4" />, instruction: 'Apply a dramatic Renaissance Chiaroscuro look with extreme contrast between light and dark.', size: '512px' },
    { id: 'duotone', label: 'Duotone', icon: <Contrast className="w-4 h-4" />, instruction: 'Transform this image into a high-contrast graphic using only two bold, complementary colors.', size: '512px' },
    { id: 'ascii', label: 'ASCII Art', icon: <Type className="w-4 h-4" />, instruction: 'Convert this image into a geeky, retro ASCII art style constructed entirely from text characters.', size: '512px' },
    { id: 'lowpoly', label: 'Low Poly', icon: <Triangle className="w-4 h-4" />, instruction: 'Transform this image into a modern geometric low-poly look made of colorful triangles.', size: '512px' },
    { id: '3d-depth', label: '3D Depth', icon: <Box className="w-4 h-4" />, instruction: 'Apply a cinematic 3D depth effect with a subtle parallax feel, making the subject stand out from the background.', size: '1K' },
    { id: 'lego', label: 'Lego/Brick', icon: <Grid className="w-4 h-4" />, instruction: 'Transform the entire image into a 3D Lego-style construction made of colorful plastic bricks.', size: '1K' },
  ];

  const AI_ACTIONS = [
    { id: 'eraser', label: 'Magic Eraser', icon: <Trash2 className="w-4 h-4" />, instruction: 'Intelligently remove unwanted objects or people from the background while seamlessly filling the space.', size: '1K' },
    { id: 'fill', label: 'Gen Fill', icon: <PlusSquare className="w-4 h-4" />, instruction: 'Add new elements to the image based on the surrounding context.', size: '1K' },
    { id: 'expand', label: 'Gen Expand', icon: <Expand className="w-4 h-4" />, instruction: 'Outpaint the edges of the photo to expand the canvas and see what is outside the original frame.', size: '1K' },
    { id: 'smile', label: 'Smile Fix', icon: <Smile className="w-4 h-4" />, instruction: 'Naturally adjust the facial expression to add a warm, genuine smile.', size: '512px' },
    { id: 'avatar', label: 'Avatarify', icon: <UserCircle className="w-4 h-4" />, instruction: 'Transform the person in the image into a stylized 3D character or artistic avatar.', size: '512px' },
    { id: 'headshot', label: 'Headshot', icon: <Briefcase className="w-4 h-4" />, instruction: 'Transform this casual photo into a professional corporate headshot with formal attire and a clean office background.', size: '1K' },
    { id: 'age', label: 'Age Slider', icon: <Baby className="w-4 h-4" />, instruction: 'Naturally adjust the perceived age of the person in the portrait.', size: '512px' },
    { id: 'relight', label: 'AI Relight', icon: <Lightbulb className="w-4 h-4" />, instruction: 'Intelligently reposition light sources to create professional studio lighting effects.', size: '1K' },
    { id: 'weather', label: 'Weather', icon: <CloudRain className="w-4 h-4" />, instruction: 'Change the environmental weather conditions (e.g., add snow, rain, or a dramatic storm).', size: '1K' },
    { id: 'outfit', label: 'Outfit Swap', icon: <Shirt className="w-4 h-4" />, instruction: 'Change the clothing of the person in the photo to a different style or outfit (e.g., change a t-shirt to a formal tuxedo).', size: '1K' },
    { id: 'hair', label: 'Hair Lab', icon: <Scissors className="w-4 h-4" />, instruction: 'Instantly change the hair color of the person in the image while maintaining natural texture and shine.', size: '512px' },
    { id: 'makeup', label: 'Makeup', icon: <Sparkles className="w-4 h-4" />, instruction: 'Apply professional virtual makeup looks or enhance existing makeup for a polished, studio-ready appearance.', size: '512px' },
  ];

  const handleQuickEdit = async (instruction: string, label: string, imageSize: "512px" | "1K" | "2K" | "4K" = "1K") => {
    if (!image || isProcessing) {
      console.log('handleQuickEdit skipped:', { hasImage: !!image, isProcessing });
      return;
    }
    
    console.log('handleQuickEdit starting:', label, 'size:', imageSize);
    setError(null);
    setIsProcessing(true);
    setStatus(`Enhancing: ${label}`);

    const thinkingMessages = [
      "Analyzing image composition...",
      "Identifying key subjects...",
      "Optimizing color spectrum...",
      "Enhancing edge definition...",
      "Applying neural filters...",
      "Refining textures...",
      "Finalizing artistic render..."
    ];
    
    let messageIndex = 0;
    setThinkingMessage(thinkingMessages[0]);
    const interval = setInterval(() => {
      messageIndex = (messageIndex + 1) % thinkingMessages.length;
      setThinkingMessage(thinkingMessages[messageIndex]);
    }, 2500);

    try {
      await ensureApiKey();
      const newImage = await performImageEdit(image, instruction, mimeType, imageSize);
      
      clearInterval(interval);
      setThinkingMessage('');

      if (newImage) {
        console.log('handleQuickEdit success:', label);
        setImageHistory(prev => [...prev, image!]);
        setRedoStack([]); // Clear redo stack on new edit
        setImage(newImage);
        setStatus(`${label} Applied`);
      } else {
        console.warn('handleQuickEdit: No image returned from performImageEdit');
        setStatus('No Change');
      }
    } catch (err: any) {
      clearInterval(interval);
      setThinkingMessage('');
      console.error(`${label} failed:`, err);
      if (err.message === 'API_KEY_MISSING' || err.message === 'API_KEY_INVALID') {
        setError('Please select a valid API key to use advanced image editing.');
        const aistudio = (window as any).aistudio;
        if (aistudio) await aistudio.openSelectKey();
      } else if (err.message === 'QUOTA_EXCEEDED') {
        setError('AI quota exceeded. Please try again later or use a different key.');
      } else {
        setError(`Failed to apply ${label}: ${err.message || 'Unknown error'}. Please try again.`);
      }
      setStatus('Failed');
    } finally {
      console.log('handleQuickEdit finally:', label);
      setIsProcessing(false);
      setTimeout(() => setStatus(isLive ? 'Live' : 'Ready'), 2000);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setError(null);
      setMimeType('image/jpeg'); // We'll convert to jpeg for efficiency
      const reader = new FileReader();
      reader.onload = async (event) => {
        const result = event.target?.result as string;
        try {
          setStatus('Optimizing...');
          const optimizedImage = await resizeImage(result);
          setImage(optimizedImage);
          setOriginalImage(optimizedImage);
          setImageHistory([]);
          setRedoStack([]);
          setStatus('Ready');
        } catch (err) {
          console.error('Failed to optimize image:', err);
          setImage(result);
          setOriginalImage(result);
          setStatus('Ready');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const stopLiveSession = useCallback(() => {
    setIsLive(false);
    setStatus('Ready');
    audioHandlerRef.current?.stop();
    sessionRef.current?.close();
    sessionRef.current = null;
  }, []);

  const startLiveSession = async () => {
    if (!image) return;
    setError(null);

    try {
      await ensureApiKey();
      setTranscription('');
      setStatus('Requesting Mic...');
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (micErr) {
        console.error('Microphone access denied:', micErr);
        setError('Microphone access denied. Please enable it to use Voice Studio.');
        return;
      }
      
      setIsLive(true);
      setStatus('Connecting...');
      
      const audioHandler = new AudioHandler((base64Data) => {
        if (sessionRef.current && !isMuted) {
          sessionRef.current.sendRealtimeInput({
            media: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
          });
        }
      });
      audioHandlerRef.current = audioHandler;

      const session = await ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-09-2025",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: "You are an expert image editor. You can help the user improve their image by listening to their instructions and calling the 'edit_image' tool. When the user asks for a change, acknowledge it and call the tool with the specific instruction. Be concise and helpful.",
          tools: [{ functionDeclarations: [EDIT_IMAGE_TOOL] }],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            console.log('Live session opened');
            setStatus('Live');
            audioHandler.start().catch(err => {
              console.error('Audio start error:', err);
              setError('Failed to start audio processor');
            });
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle transcription
            const msg = message as any;
            const inputTx = msg.inputAudioTranscription || msg.inputTranscription;
            const outputTx = msg.outputAudioTranscription || msg.outputTranscription;

            if (inputTx?.text) {
              setTranscription(prev => `You: ${inputTx.text}\n${prev}`);
            }
            if (outputTx?.text) {
              setTranscription(prev => `AI: ${outputTx.text}\n${prev}`);
            }

            if (message.serverContent?.modelTurn?.parts[0]?.inlineData?.data) {
              audioHandler.playPCM(message.serverContent.modelTurn.parts[0].inlineData.data);
            }

            if (message.toolCall) {
              const call = message.toolCall.functionCalls[0];
              if (call.name === 'edit_image') {
                const instruction = (call.args as any).instruction;
                console.log('Live session tool call: edit_image', instruction);
                
                if (!imageRef.current) {
                  console.error('Live session: No image available for editing');
                  return;
                }

                setIsProcessing(true);
                setStatus(`Editing: ${instruction}`);
                
                const thinkingMessages = [
                  "Interpreting voice command...",
                  "Analyzing image context...",
                  "Mapping instructions to pixels...",
                  "Applying AI transformations...",
                  "Refining output..."
                ];
                
                let messageIndex = 0;
                setThinkingMessage(thinkingMessages[0]);
                const interval = setInterval(() => {
                  messageIndex = (messageIndex + 1) % thinkingMessages.length;
                  setThinkingMessage(thinkingMessages[messageIndex]);
                }, 2500);
                
                try {
                  const newImage = await performImageEdit(imageRef.current, instruction, mimeTypeRef.current);
                  clearInterval(interval);
                  setThinkingMessage('');
                  if (newImage) {
                    console.log('Live session: Image updated successfully');
                    setImageHistory(prev => [...prev, imageRef.current!]);
                    setRedoStack([]);
                    setImage(newImage);
                    setStatus('Image Updated');
                  } else {
                    console.warn('Live session: performImageEdit returned null');
                    setStatus('Edit Failed');
                  }
                } catch (err: any) {
                  clearInterval(interval);
                  setThinkingMessage('');
                  console.error('Live session edit failed:', err);
                  if (err.message === 'API_KEY_INVALID' || err.message === 'API_KEY_MISSING') {
                    setError('Invalid API key. Please select a valid key.');
                    const aistudio = (window as any).aistudio;
                    if (aistudio) await aistudio.openSelectKey();
                  } else {
                    setStatus('Edit Failed');
                    setError('Image editing failed. Please try again.');
                  }
                } finally {
                  console.log('Live session edit finally');
                  setIsProcessing(false);
                  setTimeout(() => setStatus('Live'), 2000);
                }

                session.sendToolResponse({
                  functionResponses: [{
                    name: 'edit_image',
                    id: call.id,
                    response: { result: 'Image successfully edited.' }
                  }]
                });
              }
            }
          },
          onclose: () => {
            console.log('Live session closed');
            stopLiveSession();
          },
          onerror: (err) => {
            console.error('Live error:', err);
            setError(`Connection error: ${err.message || 'Unknown error'}`);
            stopLiveSession();
          }
        }
      });

      sessionRef.current = session;
    } catch (err: any) {
      console.error('Failed to start live session:', err);
      if (err.message?.includes("entity was not found") || err.message?.includes("API_KEY_INVALID")) {
        setError('Please select a valid API key to use Voice Studio.');
        const aistudio = (window as any).aistudio;
        if (aistudio) await aistudio.openSelectKey();
      } else {
        setError(err.message || 'Failed to connect to Gemini Live');
      }
      stopLiveSession();
    }
  };

  return (
    <div className="min-h-screen bg-white text-black font-sans selection:bg-purple-500/20 flex flex-col">
      {/* iOS Style Header */}
      <header className="sticky top-0 z-50 glass backdrop-blur-xl px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3 group cursor-pointer">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-blue-500 shadow-lg shadow-purple-500/30 flex items-center justify-center border border-white/20 group-hover:scale-110 transition-transform duration-500">
            <Sparkles className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight leading-none">LiveEnhancer</h1>
            <p className="text-[10px] font-mono uppercase tracking-widest text-black/60 mt-1">Your AI Photo Editing Assistant</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {thinkingMessage && (
            <div className="hidden md:flex items-center gap-2 px-4 py-1.5 bg-purple-50 rounded-full border border-purple-100 animate-pulse">
              <Loader2 className="w-3 h-3 text-purple-500 animate-spin" />
              <span className="text-[10px] font-medium text-purple-700 uppercase tracking-wider">{thinkingMessage}</span>
            </div>
          )}
          <div className="flex items-center gap-2 px-4 py-1.5 glass-dark rounded-full border border-black/5">
            <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-red-500 animate-pulse' : 'bg-purple-500'}`} />
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">{status}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Left: Immersive Image Canvas */}
        <div className="flex-1 relative flex items-center justify-center p-4 lg:p-12 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(168,85,247,0.03),transparent_70%)]" />
          
          <div className="relative w-full max-w-4xl aspect-[4/3] lg:aspect-video flex items-center justify-center">
            <AnimatePresence mode="wait">
              {image ? (
                <motion.div 
                  key="image"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.05 }}
                  className="relative w-full h-full rounded-[32px] overflow-hidden shadow-2xl border border-black/5 group"
                >
                  <div className="relative w-full h-full">
                    {/* Enhanced Image (Base) */}
                    <img 
                      src={image} 
                      alt="Enhanced" 
                      className="w-full h-full object-contain bg-black/5"
                      referrerPolicy="no-referrer"
                    />

                    {/* Original Image (Overlay) */}
                    {originalImage && (
                      <div 
                        className="absolute inset-0 overflow-hidden pointer-events-none"
                        style={{ 
                          clipPath: isSplitView 
                            ? `inset(0 ${100 - sliderPosition}% 0 0)` 
                            : (showOriginal ? 'inset(0 0 0 0)' : 'inset(0 100% 0 0)'),
                          transition: isSplitView ? 'none' : 'clip-path 0.3s ease-in-out'
                        }}
                      >
                        <img 
                          src={originalImage} 
                          alt="Original" 
                          className="w-full h-full object-contain bg-black/5"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    )}

                    {/* Split View Slider Control */}
                    {isSplitView && originalImage && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div 
                          className="absolute top-0 bottom-0 w-1 bg-white shadow-lg z-10"
                          style={{ left: `${sliderPosition}%` }}
                        >
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-xl flex items-center justify-center pointer-events-auto cursor-ew-resize border-2 border-purple-500">
                            <div className="flex gap-0.5">
                              <div className="w-0.5 h-3 bg-purple-500 rounded-full" />
                              <div className="w-0.5 h-3 bg-purple-500 rounded-full" />
                            </div>
                          </div>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={sliderPosition}
                          onChange={(e) => setSliderPosition(parseInt(e.target.value))}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize pointer-events-auto z-20"
                        />
                      </div>
                    )}
                  </div>
                  
                  {/* Floating Image Controls removed from here */}

                  {(showOriginal || isSplitView) && originalImage && (
                    <div className="absolute top-6 left-6 flex gap-2">
                      <div className="px-4 py-2 glass-dark rounded-full border border-black/5 text-xs font-bold uppercase tracking-widest text-purple-600">
                        {isSplitView ? 'Split View' : 'Original'}
                      </div>
                      {isSplitView && (
                        <div className="px-4 py-2 glass-dark rounded-full border border-black/5 text-[10px] font-mono uppercase tracking-widest text-black/60 flex items-center gap-2">
                          <span className="text-purple-500">Left:</span> Original
                          <span className="w-px h-3 bg-black/10" />
                          <span className="text-pink-500">Right:</span> Enhanced
                        </div>
                      )}
                    </div>
                  )}

                  {isProcessing && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 glass-dark flex flex-col items-center justify-center gap-6"
                    >
                      <div className="relative">
                        <Loader2 className="w-16 h-16 text-purple-500 animate-spin" />
                        <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-pink-400 animate-pulse" />
                      </div>
                      <div className="text-center space-y-2">
                        <p className="text-purple-600 font-bold text-sm uppercase tracking-[0.3em] animate-pulse">Enhancing</p>
                        <p className="text-black/60 text-[10px] font-mono uppercase tracking-widest">{status}</p>
                      </div>
                    </motion.div>
                  )}

                  {/* Vertical Control Bar */}
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 p-2 glass-dark rounded-2xl border border-black/5 shadow-xl z-30">
                    <button 
                      onMouseDown={() => !isSplitView && setShowOriginal(true)}
                      onMouseUp={() => setShowOriginal(false)}
                      onMouseLeave={() => setShowOriginal(false)}
                      onClick={() => setIsSplitView(!isSplitView)}
                      className={`p-3 rounded-xl transition-all ${isSplitView ? 'bg-purple-500 text-white shadow-lg' : 'hover:bg-black/5 text-black hover:text-purple-600'}`}
                      title={isSplitView ? "Disable Split View" : "Enable Split View (or Hold to Compare)"}
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                    <div className="h-px w-6 bg-black/5 my-1" />
                    <button 
                      onClick={handleUndo}
                      disabled={imageHistory.length === 0 || isProcessing}
                      className="p-3 hover:bg-black/5 text-black rounded-xl transition-all disabled:opacity-30"
                      title="Undo"
                    >
                      <Undo className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={handleRedo}
                      disabled={redoStack.length === 0 || isProcessing}
                      className="p-3 hover:bg-black/5 text-black rounded-xl transition-all disabled:opacity-30"
                      title="Redo"
                    >
                      <Redo className="w-5 h-5" />
                    </button>
                    <div className="h-px w-6 bg-black/5 my-1" />
                    <button 
                      onClick={handleDownload}
                      className="p-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl transition-all hover:scale-105 active:scale-95 shadow-md"
                      title="Save Image"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => { setImage(null); setOriginalImage(null); }}
                      className="p-3 hover:bg-red-500/10 text-black hover:text-red-500 rounded-xl transition-colors"
                      title="Reset"
                    >
                      <RefreshCw className="w-5 h-5" />
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.label 
                  key="upload"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full h-full rounded-[40px] border-2 border-dashed border-purple-500/20 bg-gradient-to-br from-purple-500/5 via-pink-500/5 to-blue-500/5 hover:border-purple-500/40 hover:from-purple-500/10 hover:via-pink-500/10 hover:to-blue-500/10 transition-all flex flex-col items-center justify-center cursor-pointer group relative overflow-hidden"
                >
                  {/* Decorative background glows */}
                  <div className="absolute -top-24 -left-24 w-64 h-64 bg-purple-500/10 blur-[80px] rounded-full animate-pulse" />
                  <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-blue-500/10 blur-[80px] rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
                  
                  <div className="relative z-10 flex flex-col items-center">
                    <div className="w-24 h-24 bg-gradient-to-br from-purple-500 via-pink-500 to-blue-500 rounded-[32px] flex items-center justify-center mb-8 shadow-2xl shadow-purple-500/30 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                      <Upload className="w-10 h-10 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold tracking-tight mb-3 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent">Import Photo</h3>
                    <p className="text-black/40 text-xs font-bold uppercase tracking-[0.3em]">Drag and drop or click to browse</p>
                  </div>
                  <input type="file" className="hidden" onChange={handleImageUpload} accept="image/*" />
                </motion.label>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right/Bottom: iOS Style Control Center */}
        <div className="w-full lg:w-[400px] glass border-t lg:border-t-0 lg:border-l border-black/5 flex flex-col">
          {/* Tab Navigation */}
          <div className="flex p-2 gap-1 border-b border-black/5">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-2xl transition-all ${
                  activeTab === tab.id 
                    ? 'bg-black/5 text-black shadow-sm' 
                    : 'text-black/50 hover:text-black/70'
                }`}
              >
                <span className={activeTab === tab.id ? 'text-purple-500' : ''}>{tab.icon}</span>
                <span className="text-[10px] font-bold uppercase tracking-widest">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
            <AnimatePresence mode="wait">
              {activeTab === 'magic' && (
                <motion.div 
                  key="magic"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xs font-bold uppercase tracking-widest text-purple-500">Magic AI</h2>
                      <Sparkles className="w-4 h-4 text-purple-500/20" />
                    </div>
                    <div className="grid gap-3">
                      <button
                        disabled={!image || isProcessing}
                        onClick={() => handleQuickEdit('Auto-enhance: optimize lighting, color balance, and sharpness for a professional finish.', 'Magic Auto-Fix', '512px')}
                        className="w-full py-4 bg-gradient-to-br from-purple-500 via-pink-500 to-blue-500 text-white rounded-2xl font-bold flex items-center justify-center gap-3 shadow-lg shadow-purple-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-30"
                      >
                        <Wand2 className="w-5 h-5" />
                        Magic Auto-Fix
                      </button>
                      <button
                        disabled={!image || isProcessing}
                        onClick={() => handleQuickEdit('Colorize this image, making it look natural, realistic, and vibrant. Restore colors to black and white or faded photos.', 'Colourise', '512px')}
                        className="w-full py-4 glass hover:bg-black/5 text-black rounded-2xl font-bold flex items-center justify-center gap-3 border border-black/5 transition-all disabled:opacity-30"
                      >
                        <Palette className="w-5 h-5 text-purple-500" />
                        Colourise
                      </button>
                      <button
                        disabled={!image || isProcessing}
                        onClick={() => handleQuickEdit('Enhance the portrait: smooth skin naturally, brighten eyes, and optimize lighting for the face.', 'Magic Portrait', '512px')}
                        className="w-full py-4 glass hover:bg-black/5 text-black rounded-2xl font-bold flex items-center justify-center gap-3 border border-black/5 transition-all disabled:opacity-30"
                      >
                        <Eye className="w-5 h-5 text-pink-500" />
                        Magic Portrait
                      </button>
                      <button
                        disabled={!image || isProcessing}
                        onClick={() => handleQuickEdit('Remove the background and replace it with a clean, solid white studio background.', 'Remove Background', '512px')}
                        className="w-full py-4 glass hover:bg-black/5 text-black rounded-2xl font-bold flex items-center justify-center gap-3 border border-black/5 transition-all disabled:opacity-30"
                      >
                        <Eraser className="w-5 h-5 text-blue-500" />
                        Remove Background
                      </button>
                    </div>
                  </div>

                  <div className="p-5 glass rounded-3xl border border-black/5 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center">
                        <Mic className="w-4 h-4 text-purple-500" />
                      </div>
                      <h3 className="text-sm font-bold">Voice Studio</h3>
                    </div>
                    <p className="text-xs text-black/60 leading-relaxed">
                      Tap the button below to start a live session. You can talk to Gemini to make complex edits naturally.
                    </p>
                    {!isLive ? (
                      <button 
                        disabled={!image}
                        onClick={startLiveSession}
                        className="w-full py-3 bg-black text-white rounded-xl font-bold text-sm hover:bg-black/90 transition-all disabled:opacity-30"
                      >
                        Start Live Session
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <button 
                          onClick={stopLiveSession}
                          className="w-full py-3 bg-red-500 text-white rounded-xl font-bold text-sm"
                        >
                          Stop Session
                        </button>
                        <button 
                          onClick={() => setIsMuted(!isMuted)}
                          className={`w-full py-3 rounded-xl border text-xs font-bold transition-all ${
                            isMuted ? 'bg-orange-500/10 border-orange-500/50 text-orange-500' : 'glass border-black/5 text-black'
                          }`}
                        >
                          {isMuted ? 'Microphone Muted' : 'Microphone Active'}
                        </button>
                        
                        {transcription && (
                          <div className="mt-4 p-3 bg-black/5 rounded-xl max-h-32 overflow-y-auto">
                            <p className="text-[10px] font-mono whitespace-pre-wrap text-black/60">
                              {transcription}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {activeTab === 'ai' && (
                <motion.div 
                  key="ai"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 px-1">Custom AI Instruction</label>
                    <div className="relative">
                      <textarea
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                        placeholder="e.g., 'Add a red hat' or 'Remove the car'..."
                        className="w-full p-3 glass bg-white/50 border border-black/5 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 min-h-[80px] resize-none"
                      />
                      <button
                        disabled={!image || isProcessing || !customPrompt.trim()}
                        onClick={() => {
                          handleQuickEdit(customPrompt, 'Custom Edit', '1K');
                          setCustomPrompt('');
                        }}
                        className="absolute bottom-2 right-2 p-2 bg-purple-500 text-white rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-30"
                      >
                        <Wand2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {AI_ACTIONS.map((action) => (
                      <button
                        key={action.id}
                        disabled={!image || isProcessing}
                        onClick={() => handleQuickEdit(action.instruction, action.label, (action as any).size || '1K')}
                        className="flex flex-col items-center gap-1 p-2 glass hover:bg-black/5 rounded-xl border border-black/5 transition-all group disabled:opacity-30"
                      >
                        <div className="w-8 h-8 rounded-xl bg-black/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <span className="text-blue-500">{action.icon}</span>
                        </div>
                        <span className="text-[9px] font-bold uppercase tracking-widest text-black text-center">{action.label}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {activeTab === 'edit' && (
                <motion.div 
                  key="edit"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="grid grid-cols-3 gap-2"
                >
                  {QUICK_ACTIONS.map((action) => (
                    <button
                      key={action.id}
                      disabled={!image || isProcessing}
                      onClick={() => handleQuickEdit(action.instruction, action.label, (action as any).size || '1K')}
                      className="flex flex-col items-center gap-1 p-2 glass hover:bg-black/5 rounded-xl border border-black/5 transition-all group disabled:opacity-30"
                    >
                      <div className="w-8 h-8 rounded-xl bg-black/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <span className="text-blue-500">{action.icon}</span>
                      </div>
                      <span className="text-[9px] font-bold uppercase tracking-widest text-black text-center">{action.label}</span>
                    </button>
                  ))}
                </motion.div>
              )}

              {activeTab === 'bg' && (
                <motion.div 
                  key="bg"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="grid grid-cols-3 gap-2"
                >
                  {BACKGROUND_ACTIONS.map((action) => (
                    <button
                      key={action.id}
                      disabled={!image || isProcessing}
                      onClick={() => handleQuickEdit(action.instruction, action.label, (action as any).size || '1K')}
                      className="flex flex-col items-center gap-1 p-2 glass hover:bg-black/5 rounded-xl border border-black/5 transition-all group disabled:opacity-30"
                    >
                      <div className="w-8 h-8 rounded-xl bg-black/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <span className="text-purple-500">{action.icon}</span>
                      </div>
                      <span className="text-[9px] font-bold uppercase tracking-widest text-black text-center">{action.label}</span>
                    </button>
                  ))}
                </motion.div>
              )}

              {activeTab === 'creative' && (
                <motion.div 
                  key="creative"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="grid grid-cols-3 gap-2"
                >
                  {CREATIVE_ACTIONS.map((action) => (
                    <button
                      key={action.id}
                      disabled={!image || isProcessing}
                      onClick={() => handleQuickEdit(action.instruction, action.label, (action as any).size || '1K')}
                      className="flex flex-col items-center gap-1 p-2 glass hover:bg-black/5 rounded-xl border border-black/5 transition-all group disabled:opacity-30"
                    >
                      <div className="w-8 h-8 rounded-xl bg-black/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <span className="text-pink-500">{action.icon}</span>
                      </div>
                      <span className="text-[9px] font-bold uppercase tracking-widest text-black text-center">{action.label}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Status & Errors */}
            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="p-4 bg-red-500/5 border border-red-500/10 rounded-2xl text-xs text-red-500 flex items-center gap-3"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer Branding */}
          <div className="p-6 border-t border-black/5 text-center">
            <p className="text-[9px] font-mono uppercase tracking-[0.4em] opacity-10">Powered by Gemini Live API</p>
          </div>
        </div>
      </main>
    </div>
  );
}
