'use client';

import { THEME_COLORS, ThemeColor, useThemeStore } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  TextField,
  Typography,
  CircularProgress,
} from '@mui/material';

export default function NewEnterprisePage() {
  const router = useRouter();
  const { user, enterprises, setEnterprises, setSelectedUserId } = useAuthStore();
  const { setCompany, setAccentColor } = useThemeStore();
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [themeColor, setThemeColor] = useState<ThemeColor>('teal');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !user) return;

    setLoading(true);
    try {
      const res = await fetch('/api/enterprises', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          logoUrl,
          themeColor,
          ownerId: user.id
        })
      });

      const data = await res.json();
      if (res.ok && data.enterprise) {
        // Update auth store
        setEnterprises([...enterprises, data.enterprise]);
        setSelectedUserId(data.enterprise.id);
        
        // Update theme store for immediate feedback
        setCompany({ name: data.enterprise.name, subtitle: data.enterprise.description, logoUrl: data.enterprise.logoUrl });
        setAccentColor(data.enterprise.themeColor as ThemeColor);
        
        router.push('/dashboard');
      } else {
        alert(data.error || 'Erreur lors de la création');
      }
    } catch (err) {
      console.error(err);
      alert('Erreur serveur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Créer une nouvelle entreprise
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Configurez les informations et l'apparence de votre nouvel espace de travail.
      </Typography>

      <Card>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  label="Nom de l'entreprise"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
                />
              </Grid>
              
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  label="Description / Slogan"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  helperText="Sera affiché sous le nom de l'entreprise"
                />
              </Grid>

              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  label="URL du Logo (Optionnel)"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://exemple.com/mon-logo.png"
                  helperText="Laissez vide pour utiliser l'icône par défaut"
                />
              </Grid>

              <Grid size={{ xs: 12 }}>
                <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
                  Couleur du thème
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                  {(Object.keys(THEME_COLORS) as ThemeColor[]).map((colorKey) => {
                    const color = THEME_COLORS[colorKey];
                    const isSelected = themeColor === colorKey;
                    
                    return (
                      <Box
                        key={colorKey}
                        onClick={() => setThemeColor(colorKey)}
                        sx={{
                          width: 48,
                          height: 48,
                          borderRadius: '50%',
                          bgcolor: color.main,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s',
                          border: isSelected ? '4px solid' : '2px solid transparent',
                          borderColor: isSelected ? 'text.primary' : 'transparent',
                          boxShadow: isSelected ? '0 0 0 2px ' + color.light : 'none',
                          '&:hover': {
                            transform: 'scale(1.1)',
                          }
                        }}
                        title={color.label}
                      />
                    );
                  })}
                </Box>
              </Grid>

              <Grid size={{ xs: 12 }} sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 2 }}>
                <Button 
                  variant="outlined" 
                  onClick={() => router.back()}
                  disabled={loading}
                >
                  Annuler
                </Button>
                <Button 
                  type="submit" 
                  variant="contained" 
                  disabled={loading || !name}
                  startIcon={loading && <CircularProgress size={20} />}
                >
                  Créer l'entreprise
                </Button>
              </Grid>
            </Grid>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
}