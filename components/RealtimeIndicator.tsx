import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { socketServer, SocketEvent } from '../lib/socketServer';

interface RealtimeIndicatorProps {
  className?: string;
}

export const RealtimeIndicator: React.FC<RealtimeIndicatorProps> = ({ className = '' }) => {
  const [isConnected, setIsConnected] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    // Escutar QUALQUER evento para atualizar indicador
    const events = Object.values(SocketEvent);
    
    const unsubscribers = events.map(event => 
      socketServer.on(event, () => {
        setLastUpdate(new Date());
        setIsConnected(true);
      })
    );

    // Cleanup
    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, []);

  // Detectar se ficou sem updates por muito tempo (simulação de heartbeat)
  useEffect(() => {
    const interval = setInterval(() => {
      const timeSinceUpdate = Date.now() - lastUpdate.getTime();
      // Em um sistema real com heartbeat, isso seria menor. 
      // Como é broadcast channel sob demanda, aumentamos o tempo para não dar falso negativo.
      if (timeSinceUpdate > 300000) { // 5 minutos sem updates
        // setIsConnected(false); // Opcional: Desabilitado para evitar confusão visual se o sistema estiver apenas ocioso
      }
    }, 60000); 

    return () => clearInterval(interval);
  }, [lastUpdate]);

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-500
      ${isConnected 
        ? 'bg-green-50 text-green-700 border border-green-200' 
        : 'bg-gray-50 text-gray-500 border border-gray-200'
      } ${className}`}
      title={isConnected ? `Conectado. Última atualização: ${lastUpdate.toLocaleTimeString()}` : 'Offline'}
    >
      {isConnected ? (
        <>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          <span className="hidden sm:inline">Tempo Real</span>
        </>
      ) : (
        <>
          <WifiOff size={14} />
          <span>Offline</span>
        </>
      )}
    </div>
  );
};