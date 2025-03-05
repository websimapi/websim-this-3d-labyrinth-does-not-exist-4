const { useState, useEffect, useRef } = React;
const { createRoot } = ReactDOM;

function App() {
  const [activeTab, setActiveTab] = useState('gallery');
  const [labyrinths, setLabyrinths] = useState([]);
  const [currentLabyrinth, setCurrentLabyrinth] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    seed: '',
    theme: '',
    complexity: 'medium',
    description: ''
  });
  const [error, setError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioInitialized, setAudioInitialized] = useState(false);
  const roomRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    roomRef.current = new WebsimSocket();
    
    // Initialize audio element
    const audioContainer = document.getElementById('audioContainer');
    const audio = document.createElement('audio');
    audio.src = '/labyrinth (1).mid';
    audio.loop = true;
    audioContainer.appendChild(audio);
    audioRef.current = audio;

    loadLabyrinths();
    
    return () => {
      if (roomRef.current) {
        // Any cleanup for WebsimSocket
      }
    };
  }, []);

  const loadLabyrinths = () => {
    roomRef.current.collection('labyrinth').subscribe((labs) => {
      setLabyrinths(labs);
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const playBackgroundMusic = () => {
    if (!audioInitialized && audioRef.current) {
      audioRef.current.play().catch(err => console.error("Audio play failed:", err));
      setAudioInitialized(true);
    }
  };

  const generateLabyrinth = async () => {
    try {
      setIsGenerating(true);
      setError('');
      
      // Step 1: Generate labyrinth description using LLM
      const promptText = `Create a detailed description of a mysterious 3D labyrinth with the theme "${formData.theme}" and complexity level ${formData.complexity}. 
      Include details about the biome, wall textures, ambiance, challenges, and overall atmosphere. The description should be vivid and evoke a strong mental image.
      Be specific about what makes this labyrinth unique. If there's a seed value of "${formData.seed}", incorporate that into the theme somehow.`;
      
      const completion = await websim.chat.completions.create({
        messages: [
          {
            role: "system",
            content: "You are a creative labyrinth designer who creates vivid, detailed, and imaginative descriptions of otherworldly labyrinths."
          },
          {
            role: "user",
            content: promptText
          }
        ]
      });
      
      const generatedDescription = completion.content;
      
      // Step 2: Generate image based on the description
      const imagePrompt = `A top-down view of a mysterious 3D labyrinth with theme "${formData.theme}". ${generatedDescription.slice(0, 200)}`;
      const imageResult = await websim.imageGen({
        prompt: imagePrompt,
        aspect_ratio: "1:1"
      });
      
      // Step 3: Save to database
      const labyrinth = await roomRef.current.collection('labyrinth').create({
        seed: formData.seed,
        theme: formData.theme,
        complexity: formData.complexity,
        description: generatedDescription,
        imageUrl: imageResult.url,
        generatedDescription: generatedDescription
      });
      
      setFormData({
        seed: '',
        theme: '',
        complexity: 'medium',
        description: ''
      });
      
      setActiveTab('gallery');
    } catch (err) {
      console.error("Error generating labyrinth:", err);
      setError('Failed to generate labyrinth. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const enterLabyrinth = (labyrinth) => {
    setCurrentLabyrinth(labyrinth);
    playBackgroundMusic();
    
    // Signal to the 3D renderer to create the labyrinth
    const event = new CustomEvent('enter-labyrinth', { detail: labyrinth });
    window.dispatchEvent(event);
  };

  const exitLabyrinth = () => {
    setCurrentLabyrinth(null);
    // Signal to the 3D renderer to exit
    const event = new CustomEvent('exit-labyrinth');
    window.dispatchEvent(event);
  };

  return (
    <div className="container">
      {!currentLabyrinth ? (
        <>
          <div className="header">
            <h1>This 3D Labyrinth Does Not Exist</h1>
          </div>
          
          <div className="tabs">
            <div 
              className={`tab ${activeTab === 'gallery' ? 'active' : ''}`}
              onClick={() => setActiveTab('gallery')}
            >
              Gallery
            </div>
            <div 
              className={`tab ${activeTab === 'create' ? 'active' : ''}`}
              onClick={() => setActiveTab('create')}
            >
              Create New
            </div>
          </div>
          
          {activeTab === 'gallery' && (
            <div className="gallery">
              {labyrinths.length === 0 ? (
                <div className="no-labyrinths">
                  <p>No labyrinths yet. Create the first one!</p>
                </div>
              ) : (
                labyrinths.map(lab => (
                  <div 
                    key={lab.id} 
                    className="labyrinth-card"
                    onClick={() => enterLabyrinth(lab)}
                  >
                    <img src={lab.imageUrl} alt={lab.theme} />
                    <div className="labyrinth-card-content">
                      <h3>{lab.theme}</h3>
                      <p>{lab.description ? lab.description.substring(0, 100) + '...' : ''}</p>
                      <div className="creator-info">
                        <img 
                          className="creator-avatar" 
                          src={`https://images.websim.ai/avatar/${lab.username}`} 
                          alt={lab.username} 
                        />
                        <span className="creator-name">Created by {lab.username}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
          
          {activeTab === 'create' && (
            <div className="creation-form">
              <div className="form-group">
                <label htmlFor="seed">Seed (Optional)</label>
                <input
                  type="text"
                  id="seed"
                  name="seed"
                  value={formData.seed}
                  onChange={handleInputChange}
                  placeholder="Enter a seed word or number (optional)"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="theme">Theme</label>
                <input
                  type="text"
                  id="theme"
                  name="theme"
                  value={formData.theme}
                  onChange={handleInputChange}
                  placeholder="e.g., Ancient Ruins, Crystal Caves, Floating Islands"
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="complexity">Complexity</label>
                <select
                  id="complexity"
                  name="complexity"
                  value={formData.complexity}
                  onChange={handleInputChange}
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                  <option value="extreme">Extreme</option>
                </select>
              </div>
              
              <button 
                onClick={generateLabyrinth} 
                disabled={isGenerating || !formData.theme}
              >
                {isGenerating ? (
                  <div className="loading">
                    <div className="spinner"></div>
                    <div className="loadingText">Generating your labyrinth...</div>
                  </div>
                ) : 'Generate Labyrinth'}
              </button>
              
              {error && <div className="error">{error}</div>}
            </div>
          )}
        </>
      ) : (
        <div className="game-container">
          <button className="exit-button" onClick={exitLabyrinth}>×</button>
        </div>
      )}
    </div>
  );
}

const root = createRoot(document.getElementById('app'));
root.render(<App />);

