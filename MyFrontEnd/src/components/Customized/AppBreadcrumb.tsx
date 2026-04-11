import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/Customized/breadcrumb";

import { Link, useLocation } from "react-router";
import React from "react";

function AppBreadcrumb() {
  const location = useLocation();
  const pathnames = location.pathname.split("/").filter((path) => path);
  const lastPath = pathnames[pathnames.length - 1];

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/">Home</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>

        <BreadcrumbSeparator />

        {pathnames.map((value, index) => {
          const isLast = lastPath === value;
          const route = `/${pathnames.slice(0, index + 1).join("/")}`;

          return (
            <React.Fragment key={index}>
              <BreadcrumbItem className={isLast ? "flex-1 min-w-0" : ""}>
                {isLast ? (
                  <BreadcrumbPage className="capitalize truncate ">{value}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={route} className="capitalize">
                      {value}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>

              {!isLast && <BreadcrumbSeparator />}
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export default AppBreadcrumb;
