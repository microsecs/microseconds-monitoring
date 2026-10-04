export default function PageLoading({detail="Retrieving the latest information"}:{detail?:string}) {
  return (
    <div className="pageLoadingPanel" role="status" aria-live="polite">
      <span className="spinner spinnerLarge" />
      <div>
        <strong>Loading...</strong>
        <div className="muted">{detail}</div>
      </div>
    </div>
  );
}
