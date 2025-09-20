import { redirect } from "react-router";
import type { Route } from "./+types/home";

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  if (!localStorage.getItem('authToken')) {
    return redirect('/login');
  }
  return null;
}

export default function Home() {
  return (
    <>
      hi  
    </>
  );
}
