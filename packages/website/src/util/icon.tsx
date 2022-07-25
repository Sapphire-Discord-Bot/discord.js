import { VscSymbolClass, VscSymbolMethod, VscSymbolEnum, VscSymbolInterface, VscSymbolVariable } from 'react-icons/vsc';

export function generateIcon(kind: string, className?: string) {
	const icons = {
		Class: <VscSymbolClass className={className} />,
		Method: <VscSymbolMethod className={className} />,
		Function: <VscSymbolMethod color="purple" className={className} />,
		Enum: <VscSymbolEnum className={className} />,
		Interface: <VscSymbolInterface className={className} />,
		TypeAlias: <VscSymbolVariable className={className} />,
	};

	return icons[kind as keyof typeof icons];
}