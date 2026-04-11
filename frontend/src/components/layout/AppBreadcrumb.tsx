"use client";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";

function AppBreadcrumb() {
  const pathname = usePathname();
  const pathnames = pathname.split("/").filter((path) => path);
  const lastPath = pathnames[pathnames.length - 1];

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/overview">Home</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>

        <BreadcrumbSeparator />

        {pathnames.map((value, index) => {
          const isLast = index === pathnames.length - 1;
          const route = `/${pathnames.slice(0, index + 1).join("/")}`;

          return (
            <React.Fragment key={index}>
              <BreadcrumbItem className={isLast ? "flex-1 min-w-0" : ""}>
                {isLast ? (
                  <BreadcrumbPage className="capitalize truncate">{value}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={route} className="capitalize">
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
