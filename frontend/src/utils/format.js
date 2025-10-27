export const formatDistance = (meters) => {
  const km = meters / 1000;
  return km.toFixed(2) + ' km';
};

export const formatDuration = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m ${secs}s`;
};

export const formatElevation = (meters) => {
  return Math.round(meters) + ' m';
};

export const formatPace = (distanceM, durationS) => {
  if (!distanceM || !durationS) return 'N/A';
  const km = distanceM / 1000;
  const minutesPerKm = (durationS / 60) / km;
  const mins = Math.floor(minutesPerKm);
  const secs = Math.round((minutesPerKm - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, '0')} /km`;
};

export const getSportIcon = (sport) => {
  const icons = {
    running: '🏃',
    cycling: '🚴',
    swimming: '🏊',
    hiking: '🥾',
    walking: '🚶',
  };
  return icons[sport?.toLowerCase()] || '🏃';
};

export const getSportColor = (sport) => {
  const colors = {
    running: 'bg-orange-500',
    cycling: 'bg-blue-500',
    swimming: 'bg-cyan-500',
    hiking: 'bg-green-500',
    walking: 'bg-purple-500',
  };
  return colors[sport?.toLowerCase()] || 'bg-gray-500';
};

