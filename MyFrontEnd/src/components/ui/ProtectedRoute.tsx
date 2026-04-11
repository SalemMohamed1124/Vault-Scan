import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

type ProtectedRouteProps = {
  children: React.ReactNode;
};

function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [isAuthenticated] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) navigate("/login");
  }, [isAuthenticated]);

  return isAuthenticated && children;
}

export default ProtectedRoute;
