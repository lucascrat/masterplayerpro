import type { DeviceInfo } from '../../types';

interface AdminDevicesProps {
  devices: DeviceInfo[];
  playlists: any[];
  onToggleActive: (id: string, current: boolean) => void;
  onDelete: (id: string) => void;
  onOpenEdit: (device: DeviceInfo) => void;
}

export default function AdminDevices({ devices, playlists, onToggleActive, onDelete, onOpenEdit }: AdminDevicesProps) {
  return (
    <>
      <div className="admin-page-header">
        <div>
          <h1>Dispositivos</h1>
          <p>Gerencie dispositivos e ativações de usuários</p>
        </div>
        <button className="admin-btn-primary" onClick={() => onOpenEdit({ id: '', macAddress: '', isActive: false, playlist: null })}>
          + Adicionar Dispositivo
        </button>
      </div>

      <div className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Endereço MAC</th>
              <th>Status</th>
              <th>Playlist</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {devices.map(device => (
              <tr key={device.id}>
                <td><span className="admin-mac">{device.macAddress}</span></td>
                <td>
                  <span className={`admin-badge ${device.isActive ? 'active' : 'inactive'}`} onClick={() => onToggleActive(device.id, device.isActive)} style={{ cursor: 'pointer' }}>
                    {device.isActive ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td>{device.playlist?.name || <span style={{ color: '#555' }}>Nenhuma</span>}</td>
                <td style={{ display: 'flex', gap: '8px' }}>
                  <button className="admin-btn-sm" onClick={() => onOpenEdit(device)}>Editar</button>
                  <button className="admin-btn-sm" style={{ borderColor: 'rgba(139,92,246,0.3)', color: '#8B5CF6' }} onClick={() => onDelete(device.id)}>Excluir</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
