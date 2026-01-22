import Link from "next/link";
import { Button } from "./button";
import clientLogger from "@/utils/client-logger";

interface ImportButtonProps {
    type: "test" | "user";
    disabled?: boolean;
}


export default function ImportButton({ type, disabled }: ImportButtonProps) {
    const handleImport = () => {
        clientLogger.info('テストケース一覧画面', '検索ボタン押下');
    }
    return (
        <Link href={`/importExecute?type=${type}`}>
            <Button
                disabled={disabled}
                onClick={handleImport}>
                インポート
            </Button>
        </Link>
    );
}