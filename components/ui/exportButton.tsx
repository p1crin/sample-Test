import Link from "next/link";
import { Button } from "./button";

export default function ExportButton() {
    const exportCsv = () => {
        // ファイルエクスポート処理を記載
        console.log("エクスポート実行");
    }
    return (
        <Button onClick={exportCsv} variant="default">
            エクスポート
        </Button>
    );
}