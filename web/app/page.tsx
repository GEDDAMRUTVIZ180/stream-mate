import CreateRoom from '@/components/Home/CreateRoom';

export default function Home() {
  return (
    <main className="flex justify-center items-center min-h-screen">
      <section className="flex flex-col gap-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">
            Start a <span className="text-green-500">Stream!</span>
          </h1>
          <p className="text-sm dark:text-gray-400 text-gray-500">
            Create a room by clicking the button below
          </p>
        </div>
        <CreateRoom />
      </section>
    </main>
  );
}
