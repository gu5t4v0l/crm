import EmpresaDetalhe from "@/components/EmpresaDetalhe";

export default async function EmpresaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EmpresaDetalhe id={id} />;
}
