import Link from "next/link";
import { Button } from "./button";

interface ImportButtonProps {
    type: "test" | "user";
}


export default function ImportButton({ type }: ImportButtonProps) {
    return (
        <Button variant="default">
            <Link href={`/importExecute?type=${type}`}>
                インポート
            </Link>
        </Button>
    );
}